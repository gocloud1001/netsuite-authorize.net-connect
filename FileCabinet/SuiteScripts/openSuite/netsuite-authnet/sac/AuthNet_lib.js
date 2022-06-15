
/**
 *
 * @copyright 2022 Cloud 1001, LLC
 *
 * Licensed under the Apache License, Version 2.0 w/ Common Clause (the "License");
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.gocloud1001.com/cloud1001-software-licence/
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * IN NO EVENT SHALL CLOUD 1001, LLC BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF CLOUD 1001, LLC HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * CLOUD 1001, LLC SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE AND ACCOMPANYING DOCUMENTATION, IF ANY, PROVIDED HEREUNDER IS PROVIDED "AS IS". CLOUD 1001, LLC HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
 *
 * @author Cloud 1001, LLC <suiteauthconnect@gocloud1001.com>
 *
 *
 * AuthorizeNet_lib.js
 * @NApiVersion 2.0
 * @NModuleScope Public
 *
 * @NAmdConfig ../config.json
 *
 *
 *
 *
 *
 * //API Docs for Authorize.Net :
 * https://developer.authorize.net/api/reference/index.html#payment-transactions-authorize-a-credit-card
 * https://api.authorize.net/xml/v1/schema/AnetApiSchema.xsd
 *
 * https://developer.authorize.net/hello_world/testing_guide/#Generating_Card_Responses
 *
 * Partner Portal
 * https://partner.authorize.net/widget/widget/RINT/SPA#/PartnerAccount
 *
 * Sandbox
 * https://sandbox.authorize.net/
 *
 */

define(["require", "exports", 'N/runtime', 'N/https', 'N/redirect', 'N/crypto', 'N/encode', 'N/log', 'N/record', 'N/search', 'N/format', 'N/error', 'N/config', 'N/cache', 'N/ui/message', 'moment', 'lodash', './anlib/AuthorizeNetCodes'],
    function (require, exports, runtime, https, redirect, crypto, encode, log, record, search, format, error, config, cache, message, moment, _, codes) {
    exports.VERSION = '3.1.1';

    //all the fields that are custbody_authnet_ prefixed
    exports.TOKEN = ['cim_token'];
    //exports.TOKEN = ['cim_token'];
    exports.CCFIELDS = ['ccnumber', 'ccexp', 'ccv'];
    exports.CCENTRY = _.concat(exports.TOKEN,exports.CCFIELDS);
    exports.CODES = ['datetime','authcode', 'refid', 'error_status', 'done'];
    exports.ALLAUTH = _.concat(exports.CCENTRY,exports.CODES);//exports.AUTHCAP,exports.VOIDS,exports.REFUNDS,
    exports.SERVICE_CREDENTIAL_FIELDS = ['custrecord_an_login', 'custrecord_an_login_sb', 'custrecord_an_trankey', 'custrecord_an_trankey_sb'];

    var RESPONSECODES = {
        "1" : "Approved",
        "2" : "Declined",
        "3" : "Error",
        "4" : "Held for Review",
    }
    exports.o_callResponse = {
        success : false,
        record :{},
        authResponse : {}
    };
    exports.pi_response = {
        process : false
    };
    exports.fauxResponse = {
        "messages": {
            "httpCode" : 0,
            "resultCode":"Error",
            "message":[
                {
                    "code":"Service Connection Failure",
                    "text":"There was an issue connecting from NetSuite to Authorize.Net<p>Confirm there is not a system outage for either platform"
                }
            ],
            codeZeroResponse : {}
        }
    };
    exports.AuthNetRequest = {
        authorize: {
            "createTransactionRequest": {
                "merchantAuthentication": {},
                "refId": null,
                "transactionRequest": {}
            }
        }
    };
    exports.AuthNetFraudUpdate = {
        "updateHeldTransactionRequest": {
            "merchantAuthentication": {},
            "heldTransactionRequest": {
                "action": null,
                "refTransId": null
            }
        }
    };
    exports.AuthNetTest = {
        "authenticateTestRequest": {
            "merchantAuthentication": {}
        }
    };

    exports.AuthNetSettle = {
        getTransactionDetailsRequest: {
            "merchantAuthentication": {},
            "transId": null
        }
    };
    //get status of transaction
    exports.AuthNetGetTxnStatus = {
        getTransactionDetailsRequest: {
            "merchantAuthentication": {},
            "transId": null
        }
    };
    //create profile from transaction
    exports.AuthNetGetProfileFromTxn = {
        createCustomerProfileFromTransactionRequest: {
            "merchantAuthentication": {},
            "transId": null
        }
    };
    //create NEW profile from card / bank data
    exports.AuthNetGetNewProfile = function(o_ccAuthSvcConfig) {
        return {
            createCustomerProfileRequest: {
                "merchantAuthentication": o_ccAuthSvcConfig.auth,
                "profile": {
                    "merchantCustomerId": ''
                },
                "validationMode": "testMode" //liveMode
            }
        }
    };
    //get payment profile
    exports.AuthNetGetCustomerProfileRequest = {
        getCustomerProfileRequest: {
            "merchantAuthentication": {},
            "customerProfileId": null,
            "includeIssuerInfo": "false"
        }
    };

    exports.normalizeRecType = function(type){
        //the keys are the "type" values returned when searching for a transaction
        var o_rechMap = {
            cashsale : 'cashsale',
            salesord : 'salesorder',
            salesorder : 'salesorder',
            cashrefund : 'cashrefund',
            custcred : 'creditmemo',
            customerrefund : 'creditmemo', //becasue this is the transaction that is calling it for logging
            creditmemo : 'creditmemo',
            custdep : 'customerdeposit',
            customerdeposit : 'customerdeposit',
            custinvc : 'invoice',
            invoice : 'invoice',
            custpymt : 'customerpayment',
            customerpayment : 'customerpayment',
            rtnauth : 'returnauthorization',
            returnauthorization : 'returnauthorization',
        };
        if (_.isUndefined(o_rechMap[_.toLower(type)])){
            log.emergency('exports.normalizeRecType is missing a map', 'The SuiteAuthConnect bundle is missing a map for '+type);
        }
        return o_rechMap[type];
    };

    exports.buildUUID = function(){
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            });
        }

    exports.homeSysLog = function(name, body)
    {
        if(exports.getConfigFromCache().custrecord_an_break_pci.val)
        {
            log.debug('&#10071; ' + name, body);
        }
    };

    //this is an issue with permissions on execution and You need  the 'Enable Features' permission so scripts are FULL ACCESS
    exports.hasNativeCC = function() {
        return config.load({ type: config.Type.FEATURES }).getValue({ fieldId: 'cctracking' });
    };

    //Used for finding the success or failure history records for call to auth Net - excluding CIM calls

    exports.getHistory = function (o_req) {
        //{txnid : x, txntype : y, isOK : true, mostrecent : true}
        this.homeSysLog('getHistory', 'txnid='+o_req.txnid+ ' txntype='+ o_req.txntype+ ' isOK='+ o_req.isOK+ ' mostrecent='+ o_req.mostrecent);
        var a_filters = [
            ['custrecord_an_txn', 'anyof', o_req.txnid],
            "AND",
            ['custrecord_an_cim_iscim', search.Operator.IS, false],
            "AND",
            ['custrecord_an_calledby', 'is', exports.normalizeRecType(o_req.txntype)],
        ];
        if (!o_req.mostrecent){
            if (o_req.isOK){
                a_filters.push("AND");
                a_filters.push(['custrecord_an_response_status', 'is', 'Ok']);
            } else {
                a_filters.push("AND");
                a_filters.push(['custrecord_an_response_status', 'isnot', 'Ok']);
            }
        }
        var history = search.create({
            type: 'customrecord_authnet_history',
            filters: a_filters,
            columns: [
                {name: 'internalid'},
                {name: 'custrecord_an_response'},
                {name: 'created', sort: search.Sort.DESC}
            ]
        }).run();
        var i_recentCall;
        history.each(function (result) {
            if(result) {
                i_recentCall = result.getValue('internalid');
            }
            return false;
        });
        var response = null;
        if (i_recentCall){
            response = record.load({
                type : 'customrecord_authnet_history',
                id: i_recentCall
            });
        }
        return response;
    };


    /*
    *
    * PBLKChain Logic
    *
    * */
    exports.mkpblkchain = function (cimRec, id){
        var s_rawData =
            id +
            cimRec.getValue({fieldId : 'custrecord_an_token_entity'})+
            cimRec.getValue({fieldId : 'custrecord_an_token_customerid'})+
            cimRec.getValue({fieldId : 'custrecord_an_token_token'})+
            cimRec.getValue({fieldId : 'custrecord_an_token_type'})+
            cimRec.getValue({fieldId : 'custrecord_an_token_last4'})+
            cimRec.getValue({fieldId : 'custrecord_an_token_expdate'})+
            cimRec.getValue({fieldId : 'custrecord_an_token_gateway'})+
            JSON.stringify(cimRec.getValue({fieldId : 'custrecord_tt_linked'}));
        if (cimRec.getValue({fieldId : 'custrecord_an_token_bank_routingnumber'})){
            s_rawData += cimRec.getValue({fieldId : 'custrecord_an_token_bank_routingnumber'})
        }
        if (cimRec.getValue({fieldId : 'custrecord_an_token_bank_echecktype'})){
            s_rawData += cimRec.getValue({fieldId : 'custrecord_an_token_bank_echecktype'})
        }
        s_rawData = s_rawData.replace(/\s/g, "");
        //log.debug('s_rawData', s_rawData)

        var hashObj = crypto.createHash({
            algorithm: crypto.HashAlg.SHA512
        });
        hashObj.update({
            input: s_rawData
        });
        var s_hash = hashObj.digest({
            outputEncoding: encode.Encoding.HEX
        });
        //log.debug('pblockchain', s_hash);
        return s_hash;
    };


    /*
    * Call to find any matching payment profiles for a customer to prevent duplication
    *
    */
    exports.findExistingProfile = function (customerId, profileId, paymentId) {//internalid of customer, profile ID, payment ID
        exports.homeSysLog('findExistingProfile parameters are: customerId, profileId, paymentId ', customerId +', '+ profileId +', '+  paymentId);
        var a_filters = [
            ['custrecord_an_token_entity', search.Operator.ANYOF, customerId],
            "AND",
            //['custrecord_an_token_customerid', search.Operator.IS, profileId],
            //"AND",
            //['custrecord_an_token_token', search.Operator.IS, paymentId],
            //"AND",
            ['custrecord_an_token_pblkchn_tampered', search.Operator.IS, false]
        ];

        var history = search.create({
            type: 'customrecord_authnet_tokens',
            filters: a_filters,
            columns: [
                {name: 'internalid'},
                {name: 'name'},
                {name: 'custrecord_an_token_default'},
                {name: 'custrecord_an_token_customerid'},
                {name: 'custrecord_an_token_token'},
            ]
        }).run();
        var b_hasDefault = false, i_numMethods = 0, b_thisOneExists = false;
        history.each(function (result) {
            if (result.getValue('custrecord_an_token_default')){
                b_hasDefault = true;
            }
            if (result.getValue('custrecord_an_token_customerid') === profileId
            &&
                result.getValue('custrecord_an_token_token') === paymentId
            ){
                //this one exists
                b_thisOneExists = true;
            }
            i_numMethods++;
            return true;
        });
        //this has evolved and could be cleaned up
        return {exits : b_thisOneExists, number : i_numMethods, hasDefault : b_hasDefault};
    };

    exports.parseHistory = function (txnid, txntype) {
        var o_parsedHistory = {isValid : false, status : 'ERROR', message : ''};
        //would be undefined on a create that triggers this due to logic issue or on a copy or the transformation where there is no history but the record has some field set indicating there MIGHT be history
        this.homeSysLog(txnid + ' : ' + txntype, _.isUndefined(txnid) +','+ _.isUndefined(txntype));
        if (_.isNull(txnid) || _.isNull(txntype)){
            o_parsedHistory.isValid = true;
            o_parsedHistory.status = 'OK';
        } else {
            var historyRec = this.getHistory({'txnid': txnid, 'txntype': txntype, 'isOK': false, 'mostrecent': true});
            if (_.isObject(historyRec)) {
                o_parsedHistory = {
                    isValid: _.toUpper(historyRec.getValue({fieldId: 'custrecord_an_response_status'})) === 'OK',
                    historyId : historyRec.id,
                    status: historyRec.getValue({fieldId: 'custrecord_an_response_status'}),
                    responseCode: historyRec.getValue({fieldId: 'custrecord_an_response_code'}),
                    responseCodeText : RESPONSECODES[historyRec.getValue({fieldId: 'custrecord_an_response_code'})],
                    errorCode: historyRec.getValue({fieldId: 'custrecord_an_error_code'}),
                    message: ''
                };

                if (!_.isEmpty(historyRec.getValue({fieldId: 'custrecord_an_response_message'}))) {
                    o_parsedHistory.message += historyRec.getValue({fieldId: 'custrecord_an_response_message'});
                }
                if (!_.isEmpty(historyRec.getValue({fieldId: 'custrecord_an_error_code'}))) {
                    o_parsedHistory.message += ' (' + historyRec.getValue({fieldId: 'custrecord_an_error_code'}) + ')<p>';
                } else {
                    o_parsedHistory.message += ' (res: ' + historyRec.getValue({fieldId: 'custrecord_an_response_code'}) + ')<p>';
                }

                if (!_.isEmpty(historyRec.getValue({fieldId: 'custrecord_an_response_ig_advice'}))) {
                    o_parsedHistory.message += '<br>' + historyRec.getValue({fieldId: 'custrecord_an_response_ig_advice'});
                }
                if (!_.isEmpty(historyRec.getValue({fieldId: 'custrecord_an_response_ig_other'}))) {
                    o_parsedHistory.message += '<br>' + historyRec.getValue({fieldId: 'custrecord_an_response_ig_other'});
                }
            } else {
                o_parsedHistory.message = 'This transaction did not correctly complete and log the previous Authorize.Net call.'
            }
        }
        return o_parsedHistory;
    };

    exports.getBulkRefunds = function (orgtxn, obj){
        this.homeSysLog('getBulkRefunds(obj)', obj);
        //loop through object f
        //search ID's for transaction types, date / time created
        //log.debug('??', _.map(obj, 'id'))
        var a_filters = [
            ['internalid', 'anyof', _.map(obj, 'id')],
            "AND",
            ["mainline","is","T"]
        ];
        this.homeSysLog('txnInfo filters', a_filters);
        var txnInfo = search.create({
            type: 'transaction',
            filters: a_filters,
            columns: [
                {name: 'internalid'},
                {name: 'type'},
                {name: 'datecreated'},
                {name : 'custbody_authnet_refid'},
                {name : 'tranid'},
                {name : 'entity'},
                {name:"custbody_authnet_refid", join:"appliedToTransaction"}
            ]
        }).run();
        var a_toProcess = [];
        txnInfo.each(function (result) {
            var resultObj = {
                id: +result.getValue('internalid'),
                type: result.getValue('type'),
                created: result.getValue('datecreated'),
                customerName : result.getText('entity'),
                otherrefnum : result.getValue('otherrefnum'),
                nsTxnId : result.getValue('tranid')
                //todo - get adddress billing?
                //todo - get additional info?Tax :
                // Duty :
                // Freight :
                // Tax Exempt :
                // PO Number :
            };
            if (resultObj.type === 'DepAppl') {
                resultObj.anetRefId = result.getValue({name:"custbody_authnet_refid", join:"appliedToTransaction"});
            } else {
                resultObj.anetRefId = result.getValue({name : 'custbody_authnet_refid'});
            }
            resultObj.amount = _.find(obj, {id:resultObj.id}).amount;
            exports.homeSysLog('resultObj', resultObj)
            a_toProcess.push(resultObj);
            return true;
        });
        //now find the authnet records with this tran ID and status of OK
        var a_aNetFilters = [
            [
                ['custrecord_an_call_type', 'is', 'priorAuthCaptureTransaction'],
                "OR",
                ['custrecord_an_call_type', 'is', 'authCaptureTransaction']
            ],
            "AND",
            ['custrecord_an_response_status', 'is', 'Ok'],
            "AND",
            ['custrecord_an_cim_iscim', search.Operator.IS, 'F'],
            "AND",
        ];
        var a_refIds = []; idx = 0;
        _.forEach(a_toProcess, function(refund){
           if (idx > 0){
               a_refIds.push("OR");
           }
            a_refIds.push(['custrecord_an_refid', 'is', refund.anetRefId]);
           idx++;
        });
        a_aNetFilters.push(a_refIds);
        this.homeSysLog('a_aNetFilters',a_aNetFilters);
        var authNetRecs = search.create({
            type: 'customrecord_authnet_history',
            filters: a_aNetFilters,
            columns: [
                {name: 'internalid'},
                {name: 'custrecord_an_refid'},
                {name: 'custrecord_an_card_type'},
                {name: 'custrecord_an_txn'},
                {name: 'custrecord_an_cardnum'},
                {name: 'created'}
            ]
        }).run();
        authNetRecs.each(function (result) {
            var o_aNet = {
                txnId : +result.getValue('custrecord_an_txn'),
                refid : result.getValue('custrecord_an_refid'),
                card : result.getValue('custrecord_an_card_type'),
                cardnum : result.getValue('custrecord_an_cardnum'),
                timestamp : result.getValue('created')
            };
            exports.homeSysLog('authNetRecs.each', o_aNet);
            var i_idx = _.findIndex(a_toProcess, {'anetRefId':o_aNet.refid});
            if (i_idx !== -1){
                //if there is no credit card information to factor into the refund due to how the transaction was created
                //go back to authorize.net to get the card information based off the transaction id
                if (!o_aNet.cardnum && o_aNet.refid) {
                    var live_txnLookup = exports.getStatusCheck(o_aNet.refid);
                    if (live_txnLookup.fullResponse.payment.creditCard)
                    {
                        o_aNet.cardnum = live_txnLookup.fullResponse.payment.creditCard.cardNumber;
                        o_aNet.card = live_txnLookup.fullResponse.payment.creditCard.cardType;
                    }//also do this for echeck!
                    else if(live_txnLookup.fullResponse.payment.bankAccount)
                    {
                        o_aNet.cardnum = live_txnLookup.fullResponse.payment.bankAccount.accountNumber;
                        o_aNet.card = live_txnLookup.fullResponse.payment.bankAccount.accountType;
                    }
                    //o_aNet.cardnum = live_txnLookup.fullResponse.payment.creditCard.cardNumber;
                    //o_aNet.card = live_txnLookup.fullResponse.payment.creditCard.cardType;
                }
                //add to the array of things to be processed
                a_toProcess[i_idx].anet = o_aNet;
            }
            return true;
        });
        //then for credit memos
        this.homeSysLog('processable records', a_toProcess);
        //loop over types doing refunds based on date - if the date is before today midnight - do a void else - refund
        //var o_ccAuthSvcConfig = getConfig(orgtxn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        return callBulkRefund[o_ccAuthSvcConfig.type](orgtxn, o_ccAuthSvcConfig, a_toProcess);
    };

    exports.getRefund = function (txn) {
        log.debug('getRefund. 3rd Party Call', 'getRefund()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        log.debug('getRefund.getConfig is ', o_ccAuthSvcConfig.type);
        return callRefund[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    exports.doVoid = function (txn) {
        log.debug('doVoid. 3rd Party Call', 'doVoid()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        log.debug('doVoid.getConfig is ', o_ccAuthSvcConfig.type);
        return callVoid[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    exports.doFraudApprove = function (historyRec, txn, s_approval) {
        log.debug('doFraudApprove. 3rd Party Call', 'doFraudApprove()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        log.debug('doFraudApprove.getConfig is ', o_ccAuthSvcConfig.type);
        return callFraud[o_ccAuthSvcConfig.type](historyRec, txn, o_ccAuthSvcConfig, s_approval);
    };
    exports.getAuth = function (txn) {
        log.debug('getAuth. 3rd Party AUTH Call', 'getAuth()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        exports.homeSysLog('getAuth.getConfig is ', o_ccAuthSvcConfig.type);
        return callAuth[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    exports.getStatus = function (txn) {
        log.debug('getTxnStatus. 3rd Party Status Call', 'getStatus()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        //log.debug('getAuth.getConfig is ', o_ccAuthSvcConfig.type);
        return getTxnStatus[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    exports.getStatusCheck = function (tranid) {
        log.debug('getCallStatus. 3rd Party Status Call', 'getCallStatus()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        //log.debug('getAuth.getConfig is ', o_ccAuthSvcConfig.type);
        return doCheckStatus[o_ccAuthSvcConfig.type](o_ccAuthSvcConfig,tranid);
    };
    exports.doTest = function (o_test) {
        log.debug('doTest. 3rd Party Status Call', 'doTest()');
        //log.debug('getAuth.getConfig is ', o_ccAuthSvcConfig.type);
        return doAuthTest[1](o_test);
    };
    exports.getAuthCapture = function (orgtxn) {
        log.debug('getAuthCapture. 3rd Party AUTH Call', 'getAuthCapture()');
        var txn = record.load({
            type : orgtxn.type,
            id: orgtxn.id,
            isDynamic: true });
        txn.setValue({fieldId : 'custbody_authnet_ccnumber', value : orgtxn.getValue({fieldId : 'custbody_authnet_ccnumber'})});
        txn.setValue({fieldId : 'custbody_authnet_ccexp', value : orgtxn.getValue({fieldId : 'custbody_authnet_ccexp'})});
        txn.setValue({fieldId : 'custbody_authnet_ccv', value : orgtxn.getValue({fieldId : 'custbody_authnet_ccv'})});
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        log.debug('getAuthCapture.getConfig is ', o_ccAuthSvcConfig.type);
        return callAuthCapture[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    exports.doCapture = function (txn) {
        log.debug('doCapture. 3rd Party Call', 'doCapture()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        log.debug('doCapture.getConfig is ', o_ccAuthSvcConfig.type);
        return callCapture[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    /*
    * Pull CIM data from an existing transaction
    * */
    exports.getCIM = function (txn, config) {
        log.debug('getCIM. calling AUTH.Net', 'getCIM()');
        var o_profile = mngCustomerProfile.createProfileFromTxn(txn, config);
        if (o_profile.success){
            mngCustomerProfile.getAndBuildProfile(o_profile, config);
        }
        return true;
    };

    exports.createNewProfile = function (o_profile, config) {
        log.debug('requestNewToken. building AUTH.Net', 'requestNewToken()');
        return mngCustomerProfile.createNewProfile(o_profile, config);
    };

    exports.makeToken = function (o_profile, config) {
        log.debug('makeToken. building AUTH.Net', 'makeToken()');
        mngCustomerProfile.getAndBuildProfile(o_profile, config);
        return true;
    };

    exports.importCIMToken = function (o_importedJSON) {
        log.debug('importCIMToken. building AUTH.Net', 'importCIMToken()');
        return mngCustomerProfile.importProfile(o_importedJSON);
    };

    exports.doSettlement = function (txn, settlementType) {
        log.debug('doSettlement. Direct Call', 'doSettlement()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        log.debug('doSettlement.getConfig.settlementType is ', o_ccAuthSvcConfig.type);
        return callSettlement[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    exports.getSettlmentRec = function () {
        var rec_search = search.create({
            type: 'customrecord_authnet_settlement',
            filters: [["custrecord_ans_isprocessed", "is", false]]
        });
        var results_rec_search = rec_search.run();
       var config;
        results_rec_search.each(function(result) {
            config =  {id : +result.id};
            return false;
        });
        return config;
    };


    exports.handleResponse = function(response, context, doDelete){
        //this.homeSysLog('handleResponse(response)', response);
        //this.homeSysLog('handleResponse(context)', context);
        //this.homeSysLog('handleResponse(doDelete)', doDelete);
        //the bulk refunds return an array of responses - so we are just gonna act on the first one -
        if(_.isArray(response)) {
            response = response[0]
        }
        if(response.status){
            response.txn.save({ignoreMandatoryFields : true});
        } else {
            redirect.toSuitelet({
                scriptId: 'customscript_c9_authnet_screen_svc' ,
                deploymentId: 'customdeploy_c9_authnet_screen_svc',
                parameters: {
                    orgid : response.fromId,
                    from : context.newRecord.type,
                    historyId  : response.historyId
                }
            });
            if(doDelete){
                record.delete({
                    type: context.newRecord.type,
                    id : context.newRecord.id
                });
            }
        }
    };

    //build a history record and return the stubbed out record when using EXTERNAL AUTH
    exports.makeIntegrationHistoryRec = function(txn, config){
        var b_isValid = true;
        if (config.custrecord_an_validate_external_txn.val){
            b_isValid = exports.getStatus(txn);
        } else {
            var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
            rec_response.setValue('custrecord_an_txn', txn.id);
            rec_response.setValue('custrecord_an_calledby', txn.type);
            rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
            rec_response.setValue('custrecord_an_call_type', 'authOnlyTransaction');
            //todo - setting for webstore of auth or authcapture
            rec_response.setValue('custrecord_an_amount', getBaseCurrencyTotal(txn));
            rec_response.setValue('custrecord_an_reqrefid', txn.getValue({fieldId : config.custrecord_an_external_fieldid.val}));
            rec_response.setValue('custrecord_an_refid', txn.getValue({fieldId : 'custbody_authnet_refid'}));
            rec_response.setValue('custrecord_an_response_status', 'Ok');
            rec_response.setValue('custrecord_an_response_message', 'This transaction is assumed valid and authorized prior to integration with NetSuite.');
            rec_response.setValue('custrecord_an_response_code', '1');
            rec_response.setValue('custrecord_an_response_ig_other', 'Date Created is NOT the timestamp for the event, that is when the record was sent to NetSuite');
            rec_response.save();
        }
        return b_isValid;
    };
    //a object that can hold all the appropriate auth data in cache or in a field
    exports.cacheActiveConfig = function(){
        //var rec = getConfig().rec;
        var a_cachedConfigs = [];
        var a_filters = [
            ['isinactive', 'is', 'F']
        ];
        var authnetconfig = search.create({
            type: 'customrecord_authnet_config',
            //filters: a_filters,
            filters: a_filters,
            columns: [
                {name: 'internalid', sort: search.Sort.DESC}
            ]
        }).run();
        var a_configRecId = [];
        authnetconfig.each(function (result) {
            a_configRecId.push(result.getValue('internalid'));
            //this will only return the first one
            return false;
        });
        _.forEach(a_configRecId, function (configId){
            var rec = record.load({
                type: 'customrecord_authnet_config',
                id: configId,
                isDynamic: false
            });
            //the response with the ojject components
            var o_response = {id : rec.id, type: 1, recType : rec.type, auth : {}};
            var a_allFields = rec.getFields();
            //log.debug('a_allFields', a_allFields)
            _.forEach(a_allFields, function(fld){
                if (_.startsWith( fld, 'custrecord')) {
                    //if(b_withAuth || !_.includes(exports.SERVICE_CREDENTIAL_FIELDS, fld)){
                    o_response[fld] = {
                        val: rec.getValue(fld),
                        txt: rec.getText(fld)
                    }
                    //}
                }
            });
            var live_solution = 'AAA175381';
            //var s_companyId = _.toUpper(config.load({ type: config.Type.COMPANY_INFORMATION }).getValue({ fieldId: 'companyid' }));
            var s_companyId = _.toUpper(rec.getValue({fieldId : 'custrecord_an_instanceid'}));
            o_response.solutionId = {id : live_solution};
            if (runtime.envType !== 'PRODUCTION' || _.startsWith(s_companyId, 'TSTDRV') || !rec.getValue('custrecord_an_islive'))
            {
                o_response.solutionId.id = _.sample(['AAA100302', 'AAA100303', 'AAA100304']);
            }
            if (runtime.envType === 'PRODUCTION' && rec.getValue({fieldId: 'custrecord_an_islive'})){
                o_response.auth.name = rec.getValue({fieldId: 'custrecord_an_login'});
                o_response.auth.transactionKey = rec.getValue({fieldId: 'custrecord_an_trankey'});
                o_response.authSvcUrl = rec.getValue({fieldId: 'custrecord_an_url'});
            } else {
                o_response.auth.name = rec.getValue({fieldId: 'custrecord_an_login_sb'});
                o_response.auth.transactionKey = rec.getValue({fieldId: 'custrecord_an_trankey_sb'});
                o_response.authSvcUrl = rec.getValue({fieldId: 'custrecord_an_url_sb'});
            }
            a_cachedConfigs.push(o_response);
        });
        log.audit('The Authorize.Net Cache has been refreshed', 'This data should remain in cache for about an hour');
        return a_cachedConfigs;
    };

        exports.purgeCache = function() {
            var o_cache = cache.getCache({
                name: 'config',
                scope: cache.Scope.PROTECTED
            });
            o_cache.remove({
                key: 'config'
            });
        };

    //GET AND LOAD THE CACHE AS NEEDED FOR THE CONFIG
    exports.getConfigFromCache = function(configId) {
        var o_cache = cache.getCache({
            name: 'config',
            scope: cache.Scope.PROTECTED
        });
        var o_cacheKey = o_cache.get({
                key: 'config',
                loader: this.cacheActiveConfig,
                ttl : 3600
            });
        var o_fullCache = JSON.parse(o_cacheKey);
        //log.debug(configId, o_fullCache);
        if (configId){
            return _.find(o_fullCache, {id:+configId});
        }
        else
        {
            return o_fullCache[0];
        }
        //note the [0] above returns only one of the custom records - this is for multiple configs in the future
    };

    cleanAuthNet = function (txn, doAll){
        var fields = exports.ALLAUTH;
        if (_.includes(['customerdeposit', 'customerpayment'], txn.type)){
            fields = exports.AUTHCAP
        }
        _.forEach(fields, function (fd) {
            var fld = 'custbody_authnet_'+fd;
            try {
                txn.setValue(
                    {
                        fieldId: fld,
                        value: (txn.getField(fld).type === 'checkbox') ? false : ''
                    }
                );
            } catch (e){
                log.error('cleanAuthNet . ', txn.type + ' missing ' + fld)
            }

        });
        if (doAll) {
            _.forEach(exports.CODES, function (fd) {
                var fld = 'custbody_authnet_' + fd;
                try {
                    txn.setValue(
                        {
                            fieldId: fld,
                            value: (txn.getField(fld).type === 'checkbox') ? false : ''
                        }
                    );
                } catch (e){
                    log.error('cleanAuthNet . doall', txn.type + ' missing ' + fld)
                }
            });
        }
        return txn;
    };

    getBaseCurrencyTotal = function(txn, amt){
        exports.homeSysLog('txn : ' + txn.getValue('total'), amt);
        var f_total;
        if (_.isNull(amt) || _.isUndefined(amt)) {
            f_total = txn.getValue('total') ? txn.getValue('total') : txn.getValue('payment');
            //exports.homeSysLog('f_total in null', f_total)
            if (!_.isNumber(f_total)) {
                f_total = 0;
            } else {
                f_total = f_total.toFixed(2);
            }
        } else {
            f_total = amt;
        }
        //todo : get the base currency from the company "basecurrency"
        if (txn.getField('currency') === 3){ //!= base currency
            f_total = (f_total * txn.getValue('primarycurrencyfxrate')).toFixed(2);
        }
        //exports.homeSysLog('returning f_total', f_total);
        return f_total.toString();
    };

    exports.historyParseTester = function(histRec, txnRec, response){
        return parseANetResponse(histRec, txnRec, response);
    };

    //UPDATED on 7/1/2019
    parseANetResponse = function(histRec, txnRec, response){
        var result = {
            status : true
        };
        var o_body = JSON.parse(response.body.replace('\uFEFF', ''));
        //exports.homeSysLog('parseANetResponse()', o_body);
        histRec.setValue('custrecord_an_txn', txnRec.id);
        histRec.setValue('custrecord_an_customer', _.isEmpty(txnRec.getText('customer')) ? txnRec.getValue('entity'): txnRec.getValue('customer'));
        histRec.setValue('custrecord_an_response', JSON.stringify(o_body));
        exports.homeSysLog('parseANetResponse response.code', response.code)
        exports.homeSysLog('parseANetResponse response.body', response.body)
        if (response.code === 200){
            var messages = '';
            var s_suggestion = '', s_otherSuggestions = '', a_errorCodes = [];
            //some resononses have some data based on the TYPE of failure
            if(!_.isUndefined(o_body.transactionResponse)){
                var o_respObj = _.find(codes.anetCodes, {'code':o_body.transactionResponse.responseCode});

                if(!_.isUndefined(o_body.transactionResponse.avsResultCode)){
                    histRec.setValue({fieldId: 'custrecord_an_avsresultcode', value: o_body.transactionResponse.avsResultCode});
                    //log.debug('avs status lookup', _.find(codes.avsResultCode, {'code':o_body.transactionResponse.avsResultCode}))
                    var obj = _.find(codes.avsResultCode, {'code':o_body.transactionResponse.avsResultCode});
                    if (!_.isUndefined(obj)) {
                        histRec.setValue({fieldId: 'custrecord_an_avs_status', value: obj.status});
                    }
                }
                if(!_.isUndefined(o_body.transactionResponse.cvvResultCode)){
                    histRec.setValue({fieldId: 'custrecord_an_cvvresultcode', value: o_body.transactionResponse.cvvResultCode});
                    var obj = _.find(codes.cvvResultCode, {'code':o_body.transactionResponse.cvvResultCode});
                    if (!_.isUndefined(obj)) {
                        histRec.setValue({
                            fieldId: 'custrecord_an_cvv_status',
                            value: obj.status
                        });
                    }
                }
                if(!_.isUndefined(o_body.transactionResponse.cavvResultCode)){
                    histRec.setValue({fieldId: 'custrecord_an_cavvresultcode', value: o_body.transactionResponse.cavvResultCode});
                    var obj = _.find(codes.cavvResultCode, {'code':o_body.transactionResponse.cavvResultCode});
                    if (!_.isUndefined(obj)) {
                        histRec.setValue({
                            fieldId: 'custrecord_an_cavv_status',
                            value: obj.status
                        });
                    }
                }

                histRec.setValue('custrecord_an_response_code', o_respObj.code);
                if (+o_respObj.code === 1){
                    histRec.setValue('custrecord_an_response_status', 'Ok');
                } else {
                    histRec.setValue('custrecord_an_response_status', 'Error');
                    if (_.isArray(o_body.transactionResponse.errors)){
                        _.forEach(o_body.transactionResponse.errors, function(error){
                            //histRec.setValue({fieldId: 'custrecord_an_error_code', value: error.errorCode});
                            a_errorCodes.push(error.errorCode);
                            var errorObj = _.find(codes.anetCodes, {'code':error.errorCode});
                            if (error.errorCode === '11'){
                                s_suggestion = 'A transaction with identical amount and credit card information was submitted within the previous two minutes.<br>You should remove this event from the listing under "Authorize.net History" as this transactions was successfully charged already';
                            } else {
                                s_suggestion += errorObj.integration_suggestions.replace(/&lt;br\/&gt;/g, '<br/>').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g, '"');
                            }
                            s_otherSuggestions += errorObj.other_suggestions.replace(/&lt;br\/&gt;/g, '<br/>').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g, '"')
                        });
                    }
                    histRec.setValue({fieldId: 'custrecord_an_error_code', value: a_errorCodes.toString()});
                    histRec.setValue('custrecord_an_response_ig_advice', s_suggestion);
                    histRec.setValue('custrecord_an_response_ig_other', s_otherSuggestions);
                    if(!_.isUndefined(o_body.transactionResponse.refTransID)){
                        histRec.setValue('custrecord_an_refid', o_body.transactionResponse.refTransID);
                    }
                }
                //https://support.authorize.net/s/article/MD5-Hash-End-of-Life-Signature-Key-Replacement
                if(!_.isUndefined(o_body.transactionResponse.transId)){
                    histRec.setValue({fieldId: 'custrecord_an_refid', value: o_body.transactionResponse.transId});
                }
                if(!_.isUndefined(o_body.transactionResponse.transHash)){
                    histRec.setValue('custrecord_an_hash', o_body.transactionResponse.transHash);
                }
                if(!_.isUndefined(o_body.transactionResponse.transHashSha2)){
                    histRec.setValue('custrecord_an_sha2hash', o_body.transactionResponse.transHashSha2);
                }
                if(!_.isUndefined(o_body.transactionResponse.SupplementalDataQualificationIndicator)){
                    histRec.setValue('custrecord_an_supdataqualindic', o_body.transactionResponse.SupplementalDataQualificationIndicator.toString());
                }
                histRec.setValue('custrecord_an_card_type', o_body.transactionResponse.accountType);
                histRec.setValue('custrecord_an_cardnum', o_body.transactionResponse.accountNumber);
                histRec.setValue('custrecord_an_reqrefid', o_body.refId);
                if (!_.isUndefined(o_body.transactionResponse.messages)){
                    _.forEach(o_body.transactionResponse.messages, function(message){
                        messages += message.description + ' '
                    });
                } else if (!_.isUndefined(o_body.transactionResponse.errors)){
                    _.forEach(o_body.transactionResponse.errors, function(error){
                        messages += error.errorText + ' '
                    });
                }
                histRec.setValue('custrecord_an_response_message', messages);
                //histRec.setValue('custrecord_an_response_status', o_body.messages.resultCode);
            } else if (!_.isUndefined(o_body.messages)){
                result.status =  false;
                histRec.setValue({fieldId : 'custrecord_an_response_status', value : o_body.messages.resultCode});
                _.forEach(o_body.messages.message, function (message){
                    histRec.setValue({fieldId : 'custrecord_an_error_code', value : message.code});
                    var errorObj = _.find(codes.anetCodes, {'code':message.code});
                    //log.debug('errorObj',errorObj)
                    var s_generalError = '';
                    if (errorObj.text){
                        s_generalError = errorObj.text;
                    } else if (errorObj.description) {
                        s_generalError = errorObj.description;
                    } else if (errorObj.integration_suggestions) {
                        s_generalError = errorObj.integration_suggestions;
                    }
                    s_suggestion += s_generalError.replace(/&lt;br\/&gt;/g, '<br/>').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g, '"');
                    s_otherSuggestions += errorObj.other_suggestions.replace(/&lt;br\/&gt;/g, '<br/>').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g, '"')
                    histRec.setValue({fieldId : 'custrecord_an_response_message', value : message.text});
                    histRec.setValue({fieldId : 'custrecord_an_response_ig_advice', value : s_suggestion});
                    histRec.setValue({fieldId : 'custrecord_an_response_ig_other', value :s_otherSuggestions});
                    histRec.setValue({fieldId : 'custrecord_an_reqrefid', value : txnRec.id});
                });
            } else {
                histRec.setValue('custrecord_an_response_status', 'Error');
            }
            if(_.toUpper(histRec.getValue('custrecord_an_response_status')) === 'OK'){
                txnRec.setValue('custbody_authnet_authcode', o_body.transactionResponse.authCode);
                //if this is a subsequent transaction (capture, etc) show the refTransId - reference transaction
                if (+o_body.transactionResponse.transId === 0){
                    txnRec.setValue('custbody_authnet_refid', o_body.transactionResponse.refTransID);
                    histRec.setValue('custrecord_an_refid', o_body.transactionResponse.refTransID);
                } else {
                    txnRec.setValue('custbody_authnet_refid', o_body.transactionResponse.transId);
                    histRec.setValue('custrecord_an_refid', o_body.transactionResponse.transId);
                }
                //set the request time to now
                txnRec.setValue('custbody_authnet_datetime', moment().toDate());
            } else {
                result.status =  false;
            }
        } else {
            exports.fauxResponse.httpCode = response.code;
            exports.fauxResponse.codeZeroResponse = o_body;
            log.error('error issues', exports.fauxResponse);
            histRec.setValue({ fieldId:'custrecord_an_response_status', value :'Error'});
            histRec.setValue({ fieldId:'custrecord_an_response', value :JSON.stringify(exports.fauxResponse)});
            result.status =  false;
        }
        if (!result.status){
            txnRec.setValue({fieldId: 'custbody_authnet_error_status', value : histRec.getValue({fieldId: 'custrecord_an_error_code'}) });
        } else {
            txnRec.setValue({fieldId: 'custbody_authnet_error_status', value: ''});
        }
        result.history = histRec;
        result.txn = txnRec;
        return result;
    };

    exports.generateANetTransactionRequestJSON = function (txn, b_isToken, request) {
        request.order = {};
        request.order.invoiceNumber = txn.getValue({fieldId: 'tranid'});
        if (txn.getValue({fieldId : 'salesorder'})){
            txn = record.load({
                type: 'salesorder',
                id: txn.getValue({fieldId : 'salesorder'}),
                isDynamic : true
            })
        }
        var s_customer = '';
        try {
            s_customer = txn.getText({fieldId: 'entity'}) ? txn.getText({fieldId: 'entity'}) : txn.getText({fieldId: 'customer'});
        } catch (e){
            exports.homeSysLog('generateANetTransactionRequestJSON(s_suctomer)', s_customer);
        }
        request.order.description = s_customer + ' ' + txn.type + ' from ' + exports.getConfigFromCache().custrecord_an_txn_companyname.val;
        //enhanced field data
        //todo - on payment - look back at invoice / invoices for apply lines
        request.lineItems = {lineItem: []};
        var i_numLine = +txn.getLineCount({sublistId: 'item'}) > 29 ? 29 : +txn.getLineCount({sublistId: 'item'});
        for (var i = 0; i < i_numLine; i++) {
            //txn.selectLine({ sublistId: 'item', line: i});
            var s_description = 'Terrific Item';
            var s_desc = txn.getSublistValue({sublistId: 'item', fieldId: 'description', line: i});
            if (!_.isEmpty(s_desc)) {
                s_description = s_desc.substring(0, 29);
            }
            var b_taxableItem = (+txn.getSublistValue({sublistId: 'item', fieldId: 'taxrate1', line: i}) > 0);

            //log.debug(( +txn.getSublistValue({sublistId: 'item', fieldId: 'taxrate1', line : i}) > 0));
            //adding logic for item type because negative discounts cause an issue when the rate is a percent
            //these things have no quantity - which matters later too
            var _lineQty = txn.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i}).toString();
            var b_isItem = !_.isEmpty(_lineQty);
            var unitPrice = '0', s_lineQuantity = '1';
            if (b_isItem){
                unitPrice = (txn.getSublistValue({sublistId: 'item', fieldId: 'rate', line: i})) ?
                    txn.getSublistValue({sublistId: 'item', fieldId: 'rate', line: i}) :
                    txn.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: i
                    });
                //why so weird, because Oracle NetSuite - that's why!
                //without this - BAD bug if a line on a SO is an item - but quantity is 0
                s_lineQuantity = (_lineQty === '0' || _lineQty === '' || _lineQty === ' ') ? '1' : _lineQty;
            }

            var obj = {
                'itemId': (i + 1).toString(),
                'name': txn.getSublistText({sublistId: 'item', fieldId: 'item', line: i}).substring(0, 29),
                'description': s_description,
                'quantity': s_lineQuantity,
                'unitPrice': Math.abs(unitPrice).toString(),
                'taxable': b_taxableItem
            };
            request.lineItems.lineItem.push(obj);
        }
        if (+txn.getValue({fieldId: 'taxtotal'}) > 0) {
            request.tax = {
                'amount': txn.getValue({fieldId: 'taxtotal'}),
                'name': 'TaxTotal',
                'description': 'Base Tax (US or CAN)'
            };
            //if(+txn.getValue({fieldId:'tax2total'}) > 0){
        }
        if (+txn.getValue({fieldId: 'shippingcost'}) > 0) {
            request.shipping = {
                'amount': txn.getValue({fieldId: 'shippingcost'}),
                'name': txn.getValue({fieldId: 'shipmethod'}),
                'description': 'Shipping Charges'
            };
        }
        request.poNumber = txn.getValue('otherrefnum');
        if (!b_isToken) {
            var o_lookedupCustomer = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: txn.getValue('entity') ? txn.getValue('entity') : txn.getValue('customer'),
                columns: ['firstname', 'lastname', 'companyname', 'isperson', 'email']
            });

            var o_customer = {};
            o_customer.type = o_lookedupCustomer.isperson ? 'individual' : 'business';
            o_customer.id = txn.getValue('entity');
            o_customer.email = o_lookedupCustomer.email;
            request.customer = o_customer;
            var a_billToName = txn.getValue('billaddressee');
            if (a_billToName) {
                a_billToName = txn.getValue('billaddressee').split(' ');
                if (a_billToName.length === 1) {
                    a_billToName.push('...');
                }
            } else {
                a_billToName = [];
                a_billToName.push(o_lookedupCustomer.firstname);
                a_billToName.push(o_lookedupCustomer.lastname);
            }
            //2018.1 made this happen
            var o_billingAddress = {};
            if (!_.isEmpty(o_lookedupCustomer.companyname)) {
                o_billingAddress.company = o_lookedupCustomer.companyname;
            } else {
                o_billingAddress.firstName = a_billToName[0];
                o_billingAddress.lastName = a_billToName[1];
            }
            //log.debug(txn.getValue('billingaddress'), txn.getSubrecord({fieldId: 'billingaddress'}))
            var billingSub , shippingSub;
            try {
                billingSub = txn.getSubrecord({fieldId: 'billingaddress'});
            } catch (ex) {
                exports.homeSysLog('generateANetTransactionRequestJSON(billingSub)', billingSub);
            }
            //log.debug(txn.getValue('billingaddress'))
            if (billingSub) {
                //var o_billingRec = record.load({type:'address', id: txn.getValue('billingaddress')});
                o_billingAddress.address = billingSub.getValue('addr1');
                o_billingAddress.city = billingSub.getValue('city');
                o_billingAddress.state = billingSub.getValue('state');
                o_billingAddress.zip = billingSub.getValue('zip');
                o_billingAddress.country = billingSub.getValue('country');
                o_billingAddress.phoneNumber = billingSub.getValue('addrphone');
            } else {
                o_billingAddress.address = txn.getValue('billaddr1');
                o_billingAddress.city = txn.getValue('billcity');
                o_billingAddress.state = txn.getValue('billstate');
                o_billingAddress.zip = txn.getValue('billzip');
                o_billingAddress.country = txn.getValue('billcountry');
                o_billingAddress.phoneNumber = txn.getValue('billphone');
            }
            request.billTo = o_billingAddress;
            var a_shipToName = txn.getValue('shipaddressee');
            if (a_shipToName) {
                a_shipToName = txn.getValue('shipaddressee').split(' ');
                if (a_shipToName.length === 1) {
                    a_shipToName.push('...');
                }
            } else {
                a_shipToName = [];
                a_shipToName.push(o_lookedupCustomer.firstname);
                a_shipToName.push(o_lookedupCustomer.lastname);
            }

            var o_shippingAddress = {};
            if (!_.isEmpty(o_lookedupCustomer.companyname)) {
                o_shippingAddress.company = o_lookedupCustomer.companyname;
            } else {
                o_shippingAddress.firstName = a_shipToName[0];
                o_shippingAddress.lastName = a_shipToName[1];
            }
            try {
                shippingSub = txn.getSubrecord({fieldId: 'billingaddress'});
            } catch (ex) {
                exports.homeSysLog('generateANetTransactionRequestJSON(shippingSub)', shippingSub);
            }

            if (shippingSub) {
                o_shippingAddress.address = shippingSub.getValue('addr1');
                o_shippingAddress.city = shippingSub.getValue('city');
                o_shippingAddress.state = shippingSub.getValue('state');
                o_shippingAddress.zip = shippingSub.getValue('zip');
                o_shippingAddress.country = shippingSub.getValue('country');
                //o_shippingAddress.phoneNumber = o_shippingRec.getValue('addrphone');
            } else {
                o_shippingAddress.address = txn.getValue('shipaddr1');
                o_shippingAddress.city = txn.getValue('shipcity');
                o_shippingAddress.state = txn.getValue('shipstate');
                o_shippingAddress.zip = txn.getValue('shipzip');
                o_shippingAddress.country = txn.getValue('shipcountry');
                //o_shippingAddress.phoneNumber = txn.getValue('billphone');
            }

            request.shipTo = o_shippingAddress;
        }
        return request;
    };

    var doAuthTest = {};
    doAuthTest[1] = function (o_test) {
        var o_authTestObj = {isValid : false, type : o_test.type, title : _.toUpper(o_test.type) + ' Authorize.Net connection failed'};
        exports.homeSysLog('isthisconfig', o_test);
        exports.AuthNetTest.authenticateTestRequest.merchantAuthentication = o_test.auth;
        exports.homeSysLog('doAuthTest request', exports.AuthNetTest);
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_test.url,
                body: JSON.stringify(exports.AuthNetTest)
            });
            exports.homeSysLog('doAuthTest response.body', response.body);
            var o_body = JSON.parse(response.body.replace('\uFEFF', ''));
            if (o_body.messages){
                if (o_body.messages.resultCode === 'Ok'){
                    o_authTestObj.isValid = true;
                    o_authTestObj.title = _.toUpper(o_test.type) + ' Authorize.Net connection successful';
                    o_authTestObj.level = message.Type.CONFIRMATION;
                    o_authTestObj.message = 'Successfully connects to Authorize.Net in '+ _.toUpper(o_test.type) + ' mode.';
                } else {
                    o_authTestObj.message = o_body.messages.message[0].text + ' ('+o_body.messages.message[0].code+')';
                    o_authTestObj.level = message.Type.ERROR;
                }
            } else {
                o_authTestObj.message = JSON.stringify(o_body);
                o_authTestObj.level = message.Type.ERROR;
            }
        } catch (e) {
            log.error(e);
            o_authTestObj.message = e.name + ' : '+ e.message;
            o_authTestObj.level = message.Type.ERROR;
        }
        return o_authTestObj;
    };

    var getTxnStatus = {};
    getTxnStatus[1] = function (txn, o_ccAuthSvcConfig){
        var b_canContinue = true;
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl;
        exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.transId = txn.getValue({fieldId : 'custbody_authnet_refid'});
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        rec_response.setValue('custrecord_an_txn', txn.id);
        rec_response.setValue('custrecord_an_calledby', txn.type);
        rec_response.setValue('custrecord_an_refid', txn.getValue({fieldId:'custbody_authnet_refid'}));
        rec_response.setValue('custrecord_an_reqrefid', txn.getValue({fieldId:'custbody_external_order_id'}));
        rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetGetTxnStatus)
            });
            exports.homeSysLog('getTxnStatus request', exports.AuthNetGetTxnStatus);
            exports.homeSysLog('getTxnStatus response.body', response.body);
            var o_body = JSON.parse(response.body.replace('\uFEFF', ''));
            if (o_body.transaction){
                if (+o_body.transaction.responseCode === 1){
                    rec_response.setValue({fieldId: 'custrecord_an_response_status', value : 'Ok'});
                } else {
                    rec_response.setValue({fieldId: 'custrecord_an_response_status', value: 'Error'});
                    b_canContinue = false;
                }
                rec_response.setValue({fieldId: 'custrecord_an_call_type', value : o_body.transaction.transactionType});
                rec_response.setValue({fieldId: 'custrecord_an_amount', value : o_body.transaction.authAmount});
                rec_response.setValue({fieldId: 'custrecord_an_error_code', value : o_body.transaction.responseReasonCode});
                rec_response.setValue({fieldId: 'custrecord_an_response_code', value : o_body.transaction.responseCode});
                rec_response.setValue({fieldId: 'custrecord_an_avsresultcode', value : o_body.transaction.AVSResponse});
                rec_response.setValue({fieldId: 'custrecord_an_cvvresultcode', value : o_body.transaction.cardCodeResponse});
                rec_response.setValue({fieldId: 'custrecord_an_card_type', value : o_body.transaction.payment.cardType});
                rec_response.setValue({fieldId: 'custrecord_an_cardnum', value : o_body.transaction.payment.cardNumber});
                rec_response.setValue({fieldId: 'custrecord_an_response_message', value : o_body.transaction.transactionStatus });
                rec_response.setValue({fieldId: 'custrecord_an_response_ig_other', value : o_body.transaction.responseReasonDescription });

            } else {
                if (o_body.messages) {
                    rec_response.setValue({fieldId: 'custrecord_an_response_status', value: o_body.messages.resultCode});
                    rec_response.setValue({fieldId: 'custrecord_an_error_code', value: o_body.messages.message[0].code});
                    rec_response.setValue({fieldId: 'custrecord_an_response_message', value: 'This Authorize.Net transaction ID is not valid or associated with your gateway account : '+txn.getValue({fieldId : 'custbody_authnet_refid'})});
                    rec_response.setValue({fieldId: 'custrecord_an_response_ig_advice', value : 'Validate that this is a Authorize.Net transaction in your merchant gateway.'});
                    rec_response.setValue({fieldId: 'custrecord_an_response_ig_other', value : o_body.messages.message[0].text});
                }
            }
        } catch (e) {
            log.error(e);
        } finally {
            rec_response.save();
            if (!b_canContinue){
                record.submitFields({
                    type: txn.type,
                    id : txn.id,
                    values : {
                        'custbody_authnet_error_status' : o_body.transaction.responseReasonCode,
                        //'custbody_authnet_authcode': o_body.transaction.transrefId,
                        'custbody_authnet_use': false,
                    }
                });
            } else {
                /*record.submitFields({
                    type: txn.type,
                    id : txn.id,
                    values : {
                        'custbody_authnet_error_status' : '',
                        'ccapproved': true,
                    }
                });*/
            }
        }
        return b_canContinue;
    };

    var doCheckStatus = {};
        doCheckStatus[1] = function (o_ccAuthSvcConfig, tranid){
        var o_summaryStatus = {isValidAuth : true};
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl;
        exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.transId = tranid;
        //log.debug('calling with ', exports.AuthNetGetTxnStatus);
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetGetTxnStatus)
            });
            exports.homeSysLog('getTxnStatus request', exports.AuthNetGetTxnStatus);
            exports.homeSysLog('getTxnStatus response.body', response.body);
            var o_body = JSON.parse(response.body.replace('\uFEFF', ''));
            //log.debug('o_body', o_body)
            if (o_body.transaction){
                o_summaryStatus.transactionStatus = o_body.transaction.transactionStatus
                o_summaryStatus.fullResponse = o_body.transaction;
                if (+o_body.transaction.responseCode !== 1){
                    o_summaryStatus.isValidAuth = false;
                }
                //anything can be added ro the response as this is used more
            } else {
                if (o_body.messages) {
                    o_summaryStatus.isValidAuth = false;
                }
            }
        } catch (e) {
            log.error(e);
        } finally {

        }
        return o_summaryStatus;
    };

    //extensible method to call different 3rd party auth systems
    var callAuth = {};
    //1 is the ID for Authorize.net calls
    callAuth[1] = function(txninMem, o_ccAuthSvcConfig){
        //log.debug('STARTING - callAuth[1]');
        var txn = record.load({
            type: record.Type.SALES_ORDER,
            id: txninMem.id,
            isDynamic: true
        });
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl, o_token = {}, b_isToken = false;
        //exports.homeSysLog('o_token', o_token);
        if (txn.getValue({fieldId:'custbody_authnet_cim_token'})){
            b_isToken = true;
            o_token = record.load({
                type: 'customrecord_authnet_tokens',
                id: txn.getValue({fieldId:'custbody_authnet_cim_token'})
            });
        }
        exports.AuthNetRequest.authorize.createTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        //note the order of how this object is built is critical
        exports.AuthNetRequest.authorize.createTransactionRequest.refId = txn.id;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = '';
        var f_authTotal = getBaseCurrencyTotal(txn);
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.amount = f_authTotal;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = 'authOnlyTransaction';
        //token vs ccredit card
        if (b_isToken){
            var o_profile = {};
            o_profile.customerProfileId = o_token.getValue('custrecord_an_token_customerid');
            o_profile.paymentProfile = {};
            o_profile.paymentProfile.paymentProfileId = o_token.getValue('custrecord_an_token_token');

            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.profile = o_profile;
        } else {
            //this section is irrelevant in echeck world
            var o_creditCard = {};
            o_creditCard.cardNumber = txninMem.getValue({ fieldId:'custbody_authnet_ccnumber'});
            o_creditCard.expirationDate = txninMem.getValue({ fieldId:'custbody_authnet_ccexp'});
            o_creditCard.cardCode = txninMem.getValue({ fieldId:'custbody_authnet_ccv'});
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.payment = {'creditCard' : o_creditCard};
        }
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.solution = o_ccAuthSvcConfig.solutionId;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest = exports.generateANetTransactionRequestJSON(txn, b_isToken, exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest);
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.retail = {
            'marketType' : o_ccAuthSvcConfig.custrecord_an_marketype.val ? o_ccAuthSvcConfig.custrecord_an_marketype.val : 2,//default to 2 if blank
            'deviceType' : o_ccAuthSvcConfig.custrecord_an_devicetype.val ? o_ccAuthSvcConfig.custrecord_an_devicetype.val : 5 //defaults to 5
        };

        //log.debug('POST-ing for AUTH', exports.AuthNetRequest.authorize)
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetRequest.authorize)
            });
            if (o_ccAuthSvcConfig.custrecord_an_break_pci.val){
                log.debug('&#x2623; NON-PCI-COMPLAINT Authorize.net request &#x2623;', exports.AuthNetRequest.authorize);
                log.debug('&#x2623; NON-PCI-COMPLAINT Authorize.net response &#x2623;', response.body);
            }
            exports.homeSysLog('authOnlyTransaction request', exports.AuthNetRequest.authorize);
            exports.homeSysLog('response.body', response.body);
            rec_response.setValue('custrecord_an_txn', txn.id);
            rec_response.setValue('custrecord_an_calledby', txn.type);
            rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
            rec_response.setValue('custrecord_an_call_type', exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType);
            rec_response.setValue('custrecord_an_amount', f_authTotal);

            var realTxn = txn ;
            /*var realTxn =  (b_isToken) ? txn : record.load({
                type : record.Type.SALES_ORDER,
                id: txn.id,
                isDynamic: false });*/
            //this is so critical for all other calls to have the SO internal ID!!!
            //realTxn.setValue('custbody_authnet_reqrefid', txn.id.toString());

            var parsed = parseANetResponse(rec_response, realTxn, response);

            rec_response = parsed.history;
            realTxn = parsed.txn;
            if (b_isToken && !parsed.status) {
                throw '<span style=color:red;font-weight:bold;font-size:24px>Communication with Authorize.net has failed - Unable to process the token / auth+capture / anything! </span>';
            }
        } catch (e) {
            log.error(e.name, e.message);
            var o_errorResponse = exports.fauxResponse.codeZeroResponse = response;
            rec_response.setValue('custrecord_an_response', JSON.stringify(exports.fauxResponse));
            if (e.name === 'DENIAL'){
                //this is hack for tokens
                rec_response.save();
                throw e;
            }
        } finally{
            rec_response.save();
        }
        return realTxn;
    };

    var callVoid = {};
    callVoid[1] = function(txn, o_ccAuthSvcConfig){
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl;
        exports.AuthNetRequest.authorize.createTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        //note the order of how this object is built is critical
        exports.AuthNetRequest.authorize.createTransactionRequest.refId = txn.id;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = 'voidTransaction';
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.refTransId = txn.getValue('custbody_authnet_refid');
        //now ensure all the prior auth data is GONE!
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetRequest.authorize)
            });
            log.debug('response.body', response.body);
            rec_response.setValue({fieldId: 'custrecord_an_txn', value: txn.id});
            rec_response.setValue({fieldId: 'custrecord_an_calledby',  value: txn.type});
            rec_response.setValue({fieldId: 'custrecord_an_customer',  value: _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer')});
            rec_response.setValue({fieldId: 'custrecord_an_call_type',  value: exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType});
            rec_response.setValue({fieldId: 'custrecord_an_amount',  value: getBaseCurrencyTotal(txn)});

            var realTxn = txn ;
            //realTxn.setValue({fieldId:'custbody_authnet_reqrefid', value: txn.id.toString()});

            var parsed = parseANetResponse(rec_response, realTxn, response);
            parsed.fromId = txn.id;
            //log.debug('parsed.status', parsed.status);
            //log.debug('parsed.history', parsed.history);
            //log.debug('parsed.txn', parsed.txn);

        } catch (e) {
            log.error(e);
            if (parsed){
                parsed.status = false;
            }
        } finally {
            parsed.historyId = parsed.history.save();
            delete parsed.history;
        }
        return parsed;
    };

    var callFraud = {};
    callFraud[1] = function(histRec, txn, o_ccAuthSvcConfig, s_fraudStatus){
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl;
        exports.AuthNetFraudUpdate.updateHeldTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        //note the order of how this object is built is critical
        exports.AuthNetFraudUpdate.updateHeldTransactionRequest.heldTransactionRequest.action = s_fraudStatus;
        exports.AuthNetFraudUpdate.updateHeldTransactionRequest.heldTransactionRequest.refTransId = histRec.getValue('custrecord_an_refid');
        //now ensure all the prior auth data is GONE!
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetFraudUpdate)
            });
            log.debug('response.body', response.body);
            rec_response.setValue({fieldId: 'custrecord_an_txn', value: histRec.getValue('custrecord_an_txn')});
            rec_response.setValue({fieldId: 'custrecord_an_calledby',  value: histRec.getValue('custrecord_an_calledby')});
            rec_response.setValue({fieldId: 'custrecord_an_customer',  value: histRec.getValue('custrecord_an_customer')});
            rec_response.setValue({fieldId: 'custrecord_an_call_type',  value: histRec.getValue('custrecord_an_call_type')});
            rec_response.setValue({fieldId: 'custrecord_an_amount',  value: histRec.getValue('custrecord_an_amount')});

            var realTxn = txn ;
            //realTxn.setValue({fieldId:'custbody_authnet_reqrefid', value: txn.id.toString()});

            var parsed = parseANetResponse(rec_response, realTxn, response);
            parsed.fromId = txn.id;
            //log.debug('parsed.status', parsed.status);
            //log.debug('parsed.history', parsed.history);
            //log.debug('parsed.txn', parsed.txn);

        } catch (e) {
            log.error(e);
            if (parsed){
                parsed.status = false;
            }
        } finally {
            parsed.historyId = parsed.history.save();
            delete parsed.history;
        }
        return parsed;
    };

    var callCapture = {};
    callCapture[1] = function(txn, o_ccAuthSvcConfig){
        //var soId = txn.getValue('createdfrom') ? txn.getValue('createdfrom') : txn.id;
        var soId = txn.id;
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl;
        exports.AuthNetRequest.authorize.createTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        //note the order of how this object is built is critical
        exports.AuthNetRequest.authorize.createTransactionRequest.refId = soId;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = 'priorAuthCaptureTransaction';
        var f_authTotal = getBaseCurrencyTotal(txn);
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.amount = f_authTotal;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.refTransId = txn.getValue('custbody_authnet_refid');
        //now ensure all the prior auth data is GONE!
        txn = cleanAuthNet(txn, true);
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetRequest.authorize)
            });
            exports.homeSysLog('priorAuthCaptureTransaction request', exports.AuthNetRequest.authorize);
            exports.homeSysLog('response.body', response.body);
            rec_response.setValue('custrecord_an_txn', txn.id);
            rec_response.setValue('custrecord_an_calledby', txn.type);
            rec_response.setValue('custrecord_an_refid', txn.getValue({fieldId:'custbody_authnet_refid'}));
            rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
            rec_response.setValue('custrecord_an_call_type', exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType);
            rec_response.setValue('custrecord_an_amount', f_authTotal);

            var realTxn = txn ;
            //realTxn.setValue('custbody_authnet_reqrefid', txn.id.toString());

            var parsed = parseANetResponse(rec_response, realTxn, response);
            parsed.fromId = soId;
            //log.debug('parsed.status', parsed.status);
            //log.debug('parsed.history', parsed.history);
            //log.debug('parsed.txn', parsed.txn);

        } catch (e) {
            log.error(e);
            if (parsed){
                parsed.status = false;
            }
        } finally {
            parsed.historyId = parsed.history.save();
            delete parsed.history;
        }
        return parsed;
    };

    var callAuthCapture = {};
    callAuthCapture[1] = function(txn, o_ccAuthSvcConfig){
        var soId = (txn.type === 'customerdeposit') ? txn.getValue('salesorder') : txn.id;
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl, o_token = {}, b_isToken = false;
        //exports.homeSysLog('o_token', o_token);
        if (txn.getValue({fieldId:'custbody_authnet_cim_token'})){
            b_isToken = true;
            o_token = record.load({
                type: 'customrecord_authnet_tokens',
                id: txn.getValue({fieldId:'custbody_authnet_cim_token'})
            });
        }
        exports.AuthNetRequest.authorize.createTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        //note the order of how this object is built is critical
        exports.AuthNetRequest.authorize.createTransactionRequest.refId = soId;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = 'authCaptureTransaction';
        var f_authTotal = getBaseCurrencyTotal(txn);
        //txn.setValue('custbody_authnet_amount', f_authTotal);
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.amount = f_authTotal;

        //token vs ccredit card
        if (b_isToken){
            var o_profile = {};
            o_profile.customerProfileId = o_token.getValue('custrecord_an_token_customerid');
            o_profile.paymentProfile = {};
            o_profile.paymentProfile.paymentProfileId = o_token.getValue('custrecord_an_token_token');
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.profile = o_profile;
        } else {
            //this section is irrelevant in eCheck world
            var o_creditCard = {};
            o_creditCard.cardNumber = txn.getValue({ fieldId:'custbody_authnet_ccnumber'});
            o_creditCard.expirationDate = txn.getValue({ fieldId:'custbody_authnet_ccexp'});
            o_creditCard.cardCode = txn.getValue({ fieldId:'custbody_authnet_ccv'});
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.payment = {'creditCard' : o_creditCard};
            //added 9/3/2019 to trigger on profile settings
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.profile = {createProfile : o_ccAuthSvcConfig.custrecord_an_cim_auto_generate.val};
        }
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.solution = o_ccAuthSvcConfig.solutionId;
        //added 9/3/2019 to provide more details on this transaction

        //now build the whole order like you do for an auth -
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest = exports.generateANetTransactionRequestJSON(txn, b_isToken, exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest);
        //now ensure all the prior auth data is GONE!
        txn = cleanAuthNet(txn, true);
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetRequest.authorize)
            });
            exports.homeSysLog('callAuthCapture request', exports.AuthNetRequest.authorize);
            exports.homeSysLog('response.body', response.body);
            rec_response.setValue('custrecord_an_txn', txn.id);
            rec_response.setValue('custrecord_an_calledby', txn.type);
            rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
            rec_response.setValue('custrecord_an_call_type', exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType);
            rec_response.setValue('custrecord_an_amount', f_authTotal);

            var realTxn = txn ;
            //realTxn.setValue('custbody_authnet_reqrefid', txn.id.toString());

            var parsed = parseANetResponse(rec_response, realTxn, response);
            parsed.fromId = soId;
            //log.debug('parsed.status', parsed.status);
            //log.debug('parsed.history', parsed.history);
            //log.debug('parsed.txn', parsed.txn);

            if (realTxn.getValue({fieldId :'custbody_authnet_authcode'})){
                if (!b_isToken && o_ccAuthSvcConfig.custrecord_an_cim_auto_generate.val) {
                    exports.getCIM(realTxn, o_ccAuthSvcConfig);
                }
            }

        } catch (e) {
            log.error(e.name, e.message);
            if (parsed){
                parsed.status = false;
            }
        } finally {
            parsed.historyId = parsed.history.save();
            delete parsed.history;
        }
        return parsed;
    };

    var callRefund = {};
    callRefund[1] = function(txn, o_ccAuthSvcConfig){
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl;

        exports.AuthNetRequest.authorize.createTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        //note the order of how this object is built is critical

        exports.AuthNetRequest.authorize.createTransactionRequest.refId = txn.id.toString(); //merchant provided ID
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = 'refundTransaction';
        var f_authTotal = getBaseCurrencyTotal(txn);
        //txn.setValue('custbody_authnet_amount', f_authTotal);
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.amount = f_authTotal;
        var o_createdFrom = search.lookupFields({type : 'transaction', id:txn.getValue('createdfrom'), columns :['type', 'createdfrom', 'createdfrom.type']});
        //if this is from an RMA - go back to the Sales Order
        var i_createdFrom, s_createdfromType;
        if (o_createdFrom.type[0].value === 'RtnAuth'){
            i_createdFrom = o_createdFrom.createdfrom[0].value;
            s_createdfromType = _.toLower(o_createdFrom['createdfrom.type'][0].value )
        } else {
            i_createdFrom = txn.getValue('createdfrom');
            s_createdfromType = _.toLower(o_createdFrom.type[0].value)
        }
        //var o_createdFromHistory = exports.getHistory({txnid : i_createdFrom, txntype : s_createdfromType, isOK : true, mostrecent : false});
        //exports.homeSysLog('callRefund.o_createdFromHistory', o_createdFromHistory);

        //GET the original transaction details
        var o_orgTxnResponse = doCheckStatus[1](o_ccAuthSvcConfig, txn.getValue('custbody_authnet_refid'));
        var o_paymentMethod = {}
        if (o_orgTxnResponse.fullResponse.payment.creditCard)
        {
            o_paymentMethod = {creditCard : {
                cardNumber : o_orgTxnResponse.fullResponse.payment.creditCard.cardNumber,
                expirationDate : o_orgTxnResponse.fullResponse.payment.creditCard.expirationDate,
                }
            }
        }//also do this for echeck!
        else if(o_orgTxnResponse.fullResponse.payment.bankAccount)
        {
            o_paymentMethod = {bankAccount : {
                    accountType : o_orgTxnResponse.fullResponse.payment.bankAccount.accountType,
                    routingNumber : o_orgTxnResponse.fullResponse.payment.bankAccount.routingNumber,
                    accountNumber : o_orgTxnResponse.fullResponse.payment.bankAccount.accountNumber,
                    nameOnAccount : o_orgTxnResponse.fullResponse.payment.bankAccount.nameOnAccount,
                    echeckType : o_orgTxnResponse.fullResponse.payment.bankAccount.echeckType,
                }
            }
        }

        //var s_cardString = _.isNull(o_createdFromHistory) ? '1111' : o_createdFromHistory.getValue('custrecord_an_cardnum');
        //o_creditCard.cardNumber = s_cardString.substring(s_cardString.length - 4, s_cardString.length);
        //o_creditCard.expirationDate = 'XXXX';
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.payment = o_paymentMethod;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.refTransId = txn.getValue('custbody_authnet_refid');
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.order = {};
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.order.invoiceNumber = txn.getValue('tranid');
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.order.description = txn.getValue({fieldId:'memo'}) ? txn.getValue({fieldId:'memo'}) : 'Refund';
        //enhanced field data

        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.lineItems = {lineItem : []};
        var i_numLine = +txn.getLineCount({sublistId: 'item' }) > 29 ? 29 : +txn.getLineCount({sublistId: 'item' });
        for (var i = 0; i < i_numLine; i++){
            var b_skipLine = false;
            var obj = {
                'itemId': (i + 1).toString(),
                'name': txn.getSublistValue({sublistId: 'item', fieldId: 'item', line: i}).substring(0, 29),
                'description': txn.getSublistValue({sublistId: 'item', fieldId: 'description', line: i}).substring(0, 29),
                'quantity': txn.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i}) ? txn.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i}).toString() : '1',
            };
            //ensure we are not sending over discount and subtotal lines incorrectly
            var unitPrice = 0;
            if (txn.getSublistValue({sublistId: 'item', fieldId: 'itemtype', line : i}) === 'Discount')
            {
                //unitPrice = txn.getSublistValue({sublistId: 'item', fieldId: 'amount', line : i});
            }
            else if (txn.getSublistValue({sublistId: 'item', fieldId: 'itemtype', line : i}) === 'Subtotal')
            {
                log.audit('No Refund on a', 'Subtotal line!');
                b_skipLine = true;
            }
            else
            {
                unitPrice = (txn.getSublistValue({sublistId: 'item', fieldId: 'rate', line : i})) ?
                    (txn.getSublistValue({sublistId: 'item', fieldId: 'rate', line : i})) :
                    ((txn.getSublistValue({sublistId: 'item', fieldId: 'amount', line : i})) / txn.getSublistValue({sublistId: 'item', fieldId: 'quantity', line : i}));
            }
            obj.unitPrice = unitPrice.toString();
            if (!b_skipLine) {
                exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.lineItems.lineItem.push(obj);
            }
        }
        if (+txn.getValue('shippingcost') > 0) {
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.shipping = {
                'amount': txn.getValue('shippingcost'),
                'name': txn.getText({fieldId: 'shipmethod'}),
                'description': 'Shipping Charges'
            };
        }
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.poNumber = txn.getValue('otherrefnum');
        txn = cleanAuthNet(txn, false);
        //now ensure all the prior auth data is GONE!
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        try {

            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetRequest.authorize)
            });
            //log.debug('response.body', response.body)
            rec_response.setValue('custrecord_an_txn', txn.id);
            rec_response.setValue('custrecord_an_calledby', txn.type);
            rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
            rec_response.setValue('custrecord_an_call_type', exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType);
            rec_response.setValue('custrecord_an_amount', f_authTotal);

            var realTxn = txn ;
            //realTxn.setValue('custbody_authnet_reqrefid', txn.id.toString());
            //indicates this transaction is DONE
            realTxn.setValue('custbody_authnet_done', true);
            var parsed = parseANetResponse(rec_response, realTxn, response);
            parsed.fromId = txn.getValue('createdfrom');
            //log.debug('parsed.status', parsed.status);
            //log.debug('parsed.history', parsed.history);
            //log.debug('parsed.txn', parsed.txn);
            if (!exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.refTransId){
                parsed.history.setValue({fieldId: 'custrecord_an_response_message', value:'No valid TranId / RefId was found, you may need to manually look up a previous transaction and paste the TranId / RefId on this transaction to target the refund.'})
                parsed.history.setValue({fieldId: 'custrecord_an_error_code', value:''})
                parsed.history.setValue({fieldId: 'custrecord_an_cardnum', value:''})
                parsed.history.setValue({fieldId: 'custrecord_an_response_ig_advice', value:'Find the correct TranId / RefId value from the fund capturing transaction in this transactions lifecycle, paste it in the TranId / RefId on the Cash Refund and save using Authorize.Net to apply the refund to that transaction.'})
            }
        } catch (e) {
            log.error(e);
            if (parsed){
                parsed.status = false;
            }
        } finally {
            parsed.historyId = parsed.history.save();
            delete parsed.history;
        }
        return parsed;
    };

    var callBulkRefund = {};
    callBulkRefund[1] = function(txn, o_ccAuthSvcConfig, a_toProcess){//orgtxn, o_ccAuthSvcConfig, a_toProcess
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl, o_response = [];

        _.forEach(a_toProcess, function(toRefund){
            //{"id":8791,"type":"DepAppl","created":"5/29/2018 11:31 am","anetTxnId":8524,"amount":0.35,"anet":{"refid":"40011619623","card":"Visa","timestamp":"3/19/2018 4:19 pm"}}
            exports.homeSysLog('bulkrefund (toRefund)', toRefund);
            exports.AuthNetRequest.authorize.createTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
            //note the order of how this object is built is critical

            exports.AuthNetRequest.authorize.createTransactionRequest.refId = toRefund.nsTxnId;
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = 'refundTransaction';
            var f_authTotal = getBaseCurrencyTotal(txn, toRefund.amount);
            //txn.setValue('custbody_authnet_amount', f_authTotal);
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.amount = f_authTotal;

            //log.debug('o_createdFromHistory', o_createdFromHistory)

            //GET the original transaction details
            var o_orgTxnResponse = doCheckStatus[1](o_ccAuthSvcConfig, toRefund.anet.refid);
            var o_paymentMethod = {}
            if (o_orgTxnResponse.fullResponse.payment.creditCard)
            {
                o_paymentMethod = {creditCard : {
                        cardNumber : o_orgTxnResponse.fullResponse.payment.creditCard.cardNumber,
                        expirationDate : o_orgTxnResponse.fullResponse.payment.creditCard.expirationDate,
                    }
                }
            }//also do this for echeck!
            else if(o_orgTxnResponse.fullResponse.payment.bankAccount)
            {
                o_paymentMethod = {bankAccount : {
                        accountType : o_orgTxnResponse.fullResponse.payment.bankAccount.accountType,
                        routingNumber : o_orgTxnResponse.fullResponse.payment.bankAccount.routingNumber,
                        accountNumber : o_orgTxnResponse.fullResponse.payment.bankAccount.accountNumber,
                        nameOnAccount : o_orgTxnResponse.fullResponse.payment.bankAccount.nameOnAccount,
                        echeckType : o_orgTxnResponse.fullResponse.payment.bankAccount.echeckType,
                    }
                }
            }

            /*
            var o_creditCard = {};
            var s_cardString = toRefund.anet.cardnum;
            o_creditCard.cardNumber = s_cardString.substring(s_cardString.length - 4, s_cardString.length);
            o_creditCard.expirationDate = 'XXXX';
            */

            //exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.payment = {'creditCard' : o_creditCard};
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.payment = o_paymentMethod;
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.refTransId = toRefund.anet.refid;
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.order = {};
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.order.invoiceNumber = toRefund.nsTxnId;
            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.order.description = 'Customer Refund';
            //does not use enhanced field data

            //now ensure all the prior auth data is GONE!
            var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
            try {
                var response = https.post({
                    headers: {'Content-Type': 'application/json'},
                    url: authSvcUrl,
                    body: JSON.stringify(exports.AuthNetRequest.authorize)
                });
                exports.homeSysLog('response.body', response.body);
                var s_txnType = (toRefund.type === 'DepAppl') ? 'depositapplication' : 'creditmemo';

                rec_response.setValue('custrecord_an_txn', toRefund.id);
                rec_response.setValue('custrecord_an_calledby', s_txnType);
                rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
                rec_response.setValue('custrecord_an_call_type', exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType);
                rec_response.setValue('custrecord_an_amount', f_authTotal);

                var realTxn = txn ;
                //realTxn.setValue('custbody_authnet_reqrefid', toRefund.id);
                //indicates this transaction is DONE

                var parsed = parseANetResponse(rec_response, realTxn, response);
                if (_.toUpper(parsed.history.getValue({fieldId: 'custrecord_an_response_status'})) === 'OK'){
                    realTxn.setValue('custbody_authnet_done', true);
                    parsed.status = true;
                } else {
                    parsed.status = false;
                }
                exports.homeSysLog('update ' + s_txnType, toRefund.id);
                parsed.fromId = toRefund.nsTxnId;
                exports.homeSysLog('parsed.status', parsed.status);
                exports.homeSysLog('parsed.history', parsed.history);
                exports.homeSysLog('parsed.txn', parsed.txn);
            } catch (e) {
                log.error(e.name, e.message);
                if (parsed){
                    parsed.status = false;
                }
            } finally {
                parsed.historyId = parsed.history.save();
                /*var copy = record.copy({
                    type: 'customrecord_authnet_history',
                    id : parsed.historyId,
                    isDynamic: true
                });
                copy.setValue({fieldId : 'custrecord_an_txn', value : txn.id});
                copy.save();*/
                delete parsed.history;
                o_response.push(parsed);
            }
        });
        /*record.submitFields({
            type: txn.type,
            id : txn.id,
            values : {
                'custbody_authnet_done' : true
            }
        });*/
        return o_response;
    };

    var callSettlement = {};
    //1 is the ID for Authorize.net calls
    callSettlement[1] = function(txn, o_ccAuthSvcConfig) {
        log.debug('STARTING - callSettlement[1]');
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl;
        exports.AuthNetSettle.getTransactionDetailsRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        //becasue we use differnt fields - this needs to happen
        if (txn.type === 'cashrefund'){
            exports.AuthNetSettle.getTransactionDetailsRequest.transId = txn.getValue({fieldId: 'custbody_authnet_refunded_tran'}) ? txn.getValue({fieldId: 'custbody_authnet_refunded_tran'}) : (txn.getValue({fieldId: 'custbody_magento_transid'}) ? txn.getValue({fieldId: 'custbody_magento_transid'}) : txn.getValue({fieldId: 'custbody_authnet_refid'}));
        } else {
            exports.AuthNetSettle.getTransactionDetailsRequest.transId = txn.getValue({fieldId: 'custbody_authnet_refid'});
        }

        try {
            log.debug('request', exports.AuthNetSettle);
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetSettle)
            });

            var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
            var o_body = JSON.parse(response.body.replace('\uFEFF', ''));
            exports.homeSysLog('response', o_body);
            if (o_body.transaction){
                exports.homeSysLog('_.size(o_body.transaction.lineItems)', _.size(o_body.transaction.lineItems));
                if (_.size(o_body.transaction.lineItems) > 3) {
                    o_body.transaction.lineItems = _.dropRight(o_body.transaction.lineItems, _.size(o_body.transaction.lineItems) - 3);
                }
            }
            rec_response.setValue({fieldId: 'custrecord_an_response', value: JSON.stringify(o_body)});
            rec_response.setValue({fieldId: 'custrecord_an_calledby', value: txn.type});
            rec_response.setValue({fieldId: 'custrecord_an_call_type', value: 'getTransactionDetailsRequest'});
            rec_response.setValue({
                fieldId: 'custrecord_an_customer',
                value: _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity') : txn.getValue('customer')
            });
            //rec_response.setValue('custrecord_an_amount', f_authTotal);
            rec_response.setValue({fieldId: 'custrecord_an_response_status', value: o_body.messages.resultCode});
            //set the request time to now
            //if the response is good
            if (response.code === 200) {
                if (!_.isUndefined(o_body.transaction)) {
                    if (o_body.transaction.payment.creditCard) {
                        rec_response.setValue({
                            fieldId: 'custrecord_an_card_type',
                            value: o_body.transaction.payment.creditCard.cardType
                        });
                        rec_response.setValue({
                            fieldId: 'custrecord_an_cardnum',
                            value: o_body.transaction.payment.creditCard.cardNumber
                        });
                    }
                    else if (o_body.transaction.payment.bankAccount)
                    {
                        rec_response.setValue({
                            fieldId: 'custrecord_an_card_type',
                            value: o_body.transaction.payment.bankAccount.accountType
                        });
                        rec_response.setValue({
                            fieldId: 'custrecord_an_cardnum',
                            value: o_body.transaction.payment.bankAccount.accountNumber
                        });
                    }
                    rec_response.setValue({fieldId: 'custrecord_an_txn', value: txn.id});
                    rec_response.setValue({fieldId: 'custrecord_an_reqrefid', value: o_body.transrefId});
                }
                if (_.toUpper(o_body.messages.resultCode) === 'OK') {
                    rec_response.setValue({
                        fieldId: 'custrecord_an_amount',
                        value: o_body.transaction.settleAmount
                    });
                    rec_response.setValue({
                        fieldId: 'custrecord_an_settle_status',
                        value: o_body.transaction.transactionStatus
                    });
                    txn.setValue({
                        fieldId: 'custbody_authnet_settle_status',
                        value: o_body.transaction.transactionStatus
                    });
                    txn.setValue({
                        fieldId: 'custbody_authnet_settle_markettype',
                        value: o_body.transaction.marketType
                    });
                    txn.setValue({
                        fieldId: 'custbody_authnet_settle_amount',
                        value: o_body.transaction.settleAmount
                    });
                    if (_.includes(['refundSettledSuccessfully','settledSuccessfully'], o_body.transaction.transactionStatus)) {
                        var d_settlementDate = moment(o_body.transaction.batch.settlementTimeLocal);
                        txn.setValue({
                            fieldId: 'custbody_authnet_settle_date', value: format.parse({
                                value: d_settlementDate.format('M/D/YYYY'),
                                type: format.Type.DATE
                            })
                        });
                        txn.setValue({
                            fieldId: 'custbody_authnet_batchid',
                            value: o_body.transaction.batch.batchId
                        });
                        rec_response.setValue({
                            fieldId: 'custrecord_an_settle_date', value: format.parse({
                                value: d_settlementDate.format('M/D/YYYY h:m:ss a'),
                                type: format.Type.DATETIME
                            })
                        });
                        rec_response.setValue({
                            fieldId: 'custrecord_an_settle_batchid',
                            value: o_body.transaction.batch.batchId
                        });
                    }
                    //txn.setValue('custbody_authnet_refid', o_body.transaction.transId);
                    rec_response.setValue({fieldId: 'custrecord_an_refid', value: o_body.transaction.transId});
                    rec_response.setValue({
                        fieldId: 'custrecord_an_settle_run',
                        value: exports.getSettlmentRec().id
                    });
                } else {
                    //deal with the error here
                    rec_response.setValue({fieldId: 'custrecord_an_refid', value: exports.AuthNetSettle.getTransactionDetailsRequest.transId});
                    rec_response.setValue({fieldId: 'custrecord_an_response_status', value: o_body.messages.resultCode});
                    txn.setValue({
                        fieldId: 'custbody_authnet_settle_status',
                        value: o_body.messages.message[0].text
                    });
                }
            }
            txn.save({ignoreDefaults : true});
        } catch (e) {
            log.error(e.name, e.message);
        } finally {
            rec_response.save();
        }
    };

    /*
    *
    * Profile / CIM management for tokenization logic and grabbing of tokens
    *
    *
    * */


    var mngCustomerProfile = {};
    mngCustomerProfile.createNewProfile = function(o_profile, o_ccAuthSvcConfig) {
        var o_createNewProfileResponse = {success:true, histId:null};
        var o_newProfileRequest = exports.AuthNetGetNewProfile(o_ccAuthSvcConfig);

        o_newProfileRequest.createCustomerProfileRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        o_newProfileRequest.createCustomerProfileRequest.profile.merchantCustomerId = 'NSeId-'+o_profile.getValue({fieldId: 'custrecord_an_token_entity'});
        if (o_profile.getValue({fieldId: 'custrecord_an_token_entity_email'})) {
            o_newProfileRequest.createCustomerProfileRequest.profile.email = o_profile.getValue({fieldId: 'custrecord_an_token_entity_email'});
        }
        else
        {
            o_newProfileRequest.createCustomerProfileRequest.profile.description = 'Key at : ' + o_profile.getValue({fieldId: 'custrecord_an_token_uuid'});
        }
        o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles = {};
        o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.customerType = o_profile.getValue({fieldId: 'custrecord_an_token_customer_type'});
        var o_paymentProfile = {};
        if (+o_profile.getValue({fieldId: 'custrecord_an_token_paymenttype'}) === 1) {

            o_paymentProfile.creditCard = {};
            o_paymentProfile.creditCard.cardNumber = o_profile.getValue({fieldId: 'custrecord_an_token_cardnumber'});
            o_paymentProfile.creditCard.expirationDate = o_profile.getValue({fieldId: 'custrecord_an_token_expdate'});
            o_paymentProfile.creditCard.cardCode = o_profile.getValue({fieldId: 'custrecord_an_token_cardcode'});
        }
        else {
            /*set these 2 only because - refunds!
            CCD	businessChecking	yes	yes	no	yes
            PPD	checking or savings	yes	yes	no*/
            o_paymentProfile.bankAccount = {};
            o_paymentProfile.bankAccount.accountType = o_profile.getValue({fieldId: 'custrecord_an_token_bank_accounttype'});
            o_paymentProfile.bankAccount.routingNumber = o_profile.getValue({fieldId: 'custrecord_an_token_bank_routingnumber'});
            o_paymentProfile.bankAccount.accountNumber = o_profile.getValue({fieldId: 'custrecord_an_token_bank_accountnumber'});
            o_paymentProfile.bankAccount.nameOnAccount = o_profile.getValue({fieldId: 'custrecord_an_token_bank_nameonaccount'});
            o_paymentProfile.bankAccount.echeckType = o_profile.getValue({fieldId: 'custrecord_an_token_bank_echecktype'});
            if (o_profile.getValue({fieldId: 'custrecord_an_token_bank_bankname'})){
                o_paymentProfile.bankAccount.bankName = o_profile.getValue({fieldId: 'custrecord_an_token_bank_bankname'});
            }

        }
        o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.payment = o_paymentProfile;

        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        rec_response.setValue({fieldId: 'custrecord_an_cim_iscim', value: true});
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(o_newProfileRequest)
            });
            log.debug('getCIM(createNewProfile) request', o_newProfileRequest);
            log.debug('getCIM(createNewProfile) response.body', response.body);
            var profileResponse = JSON.parse(response.body.replace('\uFEFF', ''));
            rec_response.setValue({fieldId: 'custrecord_an_response', value : JSON.stringify(profileResponse)});
            log.debug('response.body.messages', profileResponse.messages)

            rec_response.setValue({fieldId: 'custrecord_an_response_status', value : profileResponse.messages.resultCode});

            rec_response.setValue({fieldId: 'custrecord_an_calledby', value : 'newPaymentMethod'});
            rec_response.setValue({fieldId: 'custrecord_an_customer', value : o_profile.getValue({fieldId: 'custrecord_an_token_entity'})});
            rec_response.setValue({fieldId: 'custrecord_an_call_type', value : 'createCustomerProfileRequest'});
            rec_response.setValue({fieldId: 'custrecord_an_message_code', value : profileResponse.messages.message[0].code});
            rec_response.setValue({fieldId: 'custrecord_an_response_message', value : profileResponse.messages.message[0].text});

            if (_.toUpper(profileResponse.messages.resultCode) !== 'OK'){
                var errorObj = _.find(codes.anetCodes, {'code':profileResponse.messages.message[0].code});
                var s_suggestion = errorObj.integration_suggestions.replace(/&amp;lt;br \/&amp;gt;/g, '<br>');
                var s_otherSuggestions = errorObj.other_suggestions.replace(/&amp;lt;br \/&amp;gt;/g, '<br>');
                rec_response.setValue({fieldId: 'custrecord_an_response_ig_advice', value: s_suggestion});
                rec_response.setValue({fieldId: 'custrecord_an_response_ig_other', value: s_otherSuggestions});
                o_createNewProfileResponse.success = false;
                o_createNewProfileResponse.code = profileResponse.messages.message[0].code;
                o_createNewProfileResponse.message = profileResponse.messages.message[0].text;
            } else {
                o_createNewProfileResponse.nsEntityId = o_profile.getValue({fieldId: 'custrecord_an_token_entity'});
                o_createNewProfileResponse.customerProfileId = profileResponse.customerProfileId;
                o_createNewProfileResponse.customerPaymentProfileIdList = profileResponse.customerPaymentProfileIdList;
                var a_response = profileResponse.validationDirectResponseList[0].split(',');
                if (+o_profile.getValue({fieldId: 'custrecord_an_token_paymenttype'}) === 1){
                    o_createNewProfileResponse.creditCard = {
                        cardnum : a_response[50],
                        cardtype : a_response[51],
                    }
                }
                else
                {
                    o_createNewProfileResponse.bankAccount = {
                        accountNum : a_response[50],
                        accountType : a_response[51],
                    }
                }

                //todo - add more data from a good response here
            }
        } catch (e) {
            log.emergency(e.name, e.message);
            o_createNewProfileResponse.success = false;
            o_createNewProfileResponse.code = '000';
            o_createNewProfileResponse.message = e.name +' : ' + e.message;
        } finally {
            o_createNewProfileResponse.histId = rec_response.save()
        }
        log.debug('o_createNewProfileResponse', o_createNewProfileResponse);
        return o_createNewProfileResponse;

    };
    mngCustomerProfile.createProfileFromTxn = function(txn, o_ccAuthSvcConfig) {
        var o_createProfileResponse = {success:true, customerProfileId:null, txn : txn, histId:null};
        exports.AuthNetGetProfileFromTxn.createCustomerProfileFromTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetProfileFromTxn.createCustomerProfileFromTransactionRequest.transId = txn.getValue({fieldId: 'custbody_authnet_refid'});
        exports.AuthNetGetProfileFromTxn.createCustomerProfileFromTransactionRequest.customer = { merchantCustomerId : 'NSeId-'+(txn.getValue({fieldId: 'entity'}) ? txn.getValue({fieldId: 'entity'}) : txn.getValue({fieldId: 'customer'}) ) };

        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        rec_response.setValue({fieldId: 'custrecord_an_cim_iscim', value: true});
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(exports.AuthNetGetProfileFromTxn)
            });
            exports.homeSysLog('getCIM(createProfileFromTxn) request', exports.AuthNetGetProfileFromTxn);
            exports.homeSysLog('getCIM(createProfileFromTxn) response.body', response.body);
            var profileResponse = JSON.parse(response.body.replace('\uFEFF', ''));
            rec_response.setValue({fieldId: 'custrecord_an_response', value : JSON.stringify(profileResponse)});
            //log.debug('response.body.messages', profileResponse.messages)

            rec_response.setValue({fieldId: 'custrecord_an_response_status', value : profileResponse.messages.resultCode});
            rec_response.setValue({fieldId: 'custrecord_an_txn', value : txn.id});
            //maybe enable in the future, but solved in the refund call
            //rec_response.setValue({fieldId: 'custrecord_an_related_txnid', value : txn.getValue({fieldId: 'custbody_authnet_refid'})});
            rec_response.setValue({fieldId: 'custrecord_an_calledby', value : txn.type});
            rec_response.setValue({fieldId: 'custrecord_an_customer', value : _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer')});
            rec_response.setValue({fieldId: 'custrecord_an_call_type', value : 'createCustomerProfileFromTransactionRequest'});
            rec_response.setValue({fieldId: 'custrecord_an_message_code', value : profileResponse.messages.message[0].code});
            rec_response.setValue({fieldId: 'custrecord_an_response_message', value : profileResponse.messages.message[0].text});

            if (_.toUpper(profileResponse.messages.resultCode) !== 'OK'){
                var errorObj = _.find(codes.anetCodes, {'code':profileResponse.messages.message[0].code});
                var s_suggestion = errorObj.integration_suggestions.replace(/&amp;lt;br \/&amp;gt;/g, '<br>');
                var s_otherSuggestions = errorObj.other_suggestions.replace(/&amp;lt;br \/&amp;gt;/g, '<br>');
                rec_response.setValue({fieldId: 'custrecord_an_response_ig_advice', value: s_suggestion});
                rec_response.setValue({fieldId: 'custrecord_an_response_ig_other', value: s_otherSuggestions});
                o_createProfileResponse.success = false;
            } else {
                o_createProfileResponse.nsEntityId = _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer');
                o_createProfileResponse.customerProfileId = profileResponse.customerProfileId;
                o_createProfileResponse.customerPaymentProfileIdList = profileResponse.customerPaymentProfileIdList;
            }
        } catch (e) {
            log.emergency(e.name, e.message);
            o_createProfileResponse.success = false;
        } finally {
            o_createProfileResponse.histId = rec_response.save()
        }
        return o_createProfileResponse;
    };

    mngCustomerProfile.getProfile = function(o_profile, o_ccAuthSvcConfig) {
        exports.homeSysLog('getProfile(o_profile.customerProfileId & o_profile.customerPaymentProfileIdList)', o_profile.customerProfileId + ' :: ' + o_profile.customerPaymentProfileIdList);
        //var o_createProfileResponse = {success:true, customerProfileId:null, txn : txn};
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.customerProfileId = o_profile.customerProfileId;
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(exports.AuthNetGetCustomerProfileRequest)
            });
            exports.homeSysLog('getCIM(getCustomerProfileRequest) request', exports.AuthNetGetCustomerProfileRequest);
            exports.homeSysLog('getCIM(getCustomerProfileRequest) response.body', response.body);
            return  JSON.parse(response.body.replace('\uFEFF', ''));
        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            //o_createProfileResponse.success = false;
        } finally {
            //rec_response.save()
        }
    };

    mngCustomerProfile.importProfile = function(o_profile_JSON) {
        exports.homeSysLog('importProfile(o_profile_JSON)', o_profile_JSON);
        //get the config value from cache that we are looking for
        var o_ccAuthSvcConfig = exports.getConfigFromCache(+o_profile_JSON.fields.custrecord_an_token_gateway);
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.customerProfileId = o_profile_JSON.fields.custrecord_an_token_customerid ;
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(exports.AuthNetGetCustomerProfileRequest)
            });
            exports.homeSysLog('getCIM(getCustomerProfileRequest) request', exports.AuthNetGetCustomerProfileRequest);
            exports.homeSysLog('getCIM(getCustomerProfileRequest) response.body', response.body);
            return  JSON.parse(response.body.replace('\uFEFF', ''));
        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            //o_createProfileResponse.success = false;
        } finally {
            //rec_response.save()
        }
    };

    mngCustomerProfile.getAndBuildProfile = function(o_profile, o_ccAuthSvcConfig) {
        exports.homeSysLog('getAndBuildProfile(o_profile.customerProfileId & o_profile.customerPaymentProfileIdList)', o_profile.customerProfileId + ' :: ' + o_profile.customerPaymentProfileIdList);
        try{
            var profileResponse = mngCustomerProfile.getProfile(o_profile, o_ccAuthSvcConfig);
            //rec_response.setValue({fieldId: 'custrecord_an_response', value : JSON.stringify(profileResponse)});
            //log.debug('response.body.messages', profileResponse.messages);
            exports.homeSysLog('profileResponse.profile.paymentProfiles', profileResponse.profile.paymentProfiles);
            var a_usedProfiles = [];
            //loop on the array of ID's used in customerPaymentProfileIdList":["1832901197"]
            _.forEach(o_profile.customerPaymentProfileIdList, function(profileId){
                //log .debug(profileId, 'Well?')
                var profile = _.find(profileResponse.profile.paymentProfiles, {"customerPaymentProfileId":profileId});
                if (!_.isUndefined(profile)){
                    a_usedProfiles.push(profile);
                }
            });
            exports.homeSysLog('a_usedProfiles', a_usedProfiles);
            _.forEach(a_usedProfiles, function(profile){
                var o_currentTokenHistory = exports.findExistingProfile(o_profile.nsEntityId, profileResponse.profile.customerProfileId, profile.customerPaymentProfileId);
                log.debug('o_currentTokenHistory', o_currentTokenHistory);
                //{exits : b_thisOneExists, number : i_numMethods, hasDefault : b_hasDefault}
                if (!o_currentTokenHistory.exits){
                    log.debug('building a new profile CIM', profile);
                    var rec_cimProfile = record.create({type: 'customrecord_authnet_tokens', isDynamic: true});
                    rec_cimProfile.setValue({fieldId: 'custrecord_an_token_gateway', value: o_ccAuthSvcConfig.id});
                    rec_cimProfile.setValue({fieldId: 'custrecord_an_token_entity', value: o_profile.nsEntityId});
                    rec_cimProfile.setValue({fieldId: 'custrecord_an_token_customerid', value: profileResponse.profile.customerProfileId});
                    rec_cimProfile.setValue({fieldId: 'custrecord_an_token_token', value: profile.customerPaymentProfileId});
                    if (!_.isUndefined(profile.payment.creditCard)){
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_paymenttype', value : 1});
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_type', value : profile.payment.creditCard.cardType});
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_last4', value : profile.payment.creditCard.cardNumber});
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_expdate', value : profile.payment.creditCard.expirationDate});
                        rec_cimProfile.setValue({fieldId: 'name', value :profile.payment.creditCard.cardType +' ('+profile.payment.creditCard.cardNumber+')'});
                    }
                    else if (profile.payment.bankAccount)
                    {
                        //bankAccount
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_paymenttype', value : 2});
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_type', value : profile.payment.bankAccount.accountType});
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_last4', value : profile.payment.bankAccount.accountNumber});
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_bank_routingnumber', value : profile.payment.bankAccount.routingNumber});
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_bank_nameonaccount', value : profile.payment.bankAccount.nameOnAccount});
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_expdate', value : ''});
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_bank_accounttype', value : profile.payment.bankAccount.accountType});
                        rec_cimProfile.setValue({fieldId: 'custrecord_an_token_bank_echecktype', value : profile.payment.bankAccount.echeckType});
                        rec_cimProfile.setValue({fieldId: 'name', value :'Bank Account ('+profile.payment.bankAccount.accountNumber+')'});
                    }
                    else
                    {
                        rec_cimProfile.setValue({fieldId: 'name', value :profileResponse.profile.description});
                    }
                    if (!o_currentTokenHistory.hasDefault) {
                        //if none of the found tokens is default, make this one default
                        rec_cimProfile.setValue({
                            fieldId: 'custrecord_an_token_default',
                            value: true
                        });
                    }
                    var cimId = rec_cimProfile.save();
                    exports.homeSysLog('NEW CIM ID', cimId);
                    //becasue UE's can't call UE's - this needs to self run here, otehrwise the record will take care of itself!
                    if (runtime.executionContext === runtime.ContextType.USER_EVENT) {
                        record.submitFields({
                            type: rec_cimProfile.type,
                            id: cimId,
                            values: {
                                custrecord_an_token_pblkchn: exports.mkpblkchain(rec_cimProfile, cimId)
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });
                    }
                }
            });
        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            //o_createProfileResponse.success = false;
        } finally {
            //rec_response.save()
        }
    };


return exports;
});


