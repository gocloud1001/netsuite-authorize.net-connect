
/**
 *
 * @copyright 2025 Cloud 1001, LLC
 *
 * Licensed under the Apache License, Version 2.0 w/ Commons Clause (the "License");
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
 * @NApiVersion 2.x
 * @NModuleScope Public
 *
 * @NAmdConfig /SuiteScripts/openSuite/netsuite-authnet/config.json
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

define(["require", "exports", 'N/url', 'N/runtime', 'N/https', 'N/redirect', 'N/crypto', 'N/encode', 'N/log', 'N/record', 'N/search', 'N/format', 'N/error', 'N/config', 'N/cache', 'N/ui/message', 'SuiteScripts/openSuite/netsuite-authnet/lib/moment.min', 'SuiteScripts/openSuite/netsuite-authnet/lib/lodash.min', 'SuiteScripts/openSuite/netsuite-authnet/sac/anlib/AuthorizeNetCodes'],
    function (require, exports, url, runtime, https, redirect, crypto, encode, log, record, search, format, error, config, cache, message, moment, _, codes) {
    exports.VERSION = '2025.1.3';
    //all the fields that are custbody_authnet_ prefixed
    exports.TOKEN = ['cim_token'];
    exports.CHECKBOXES = ['use', 'override'];
    exports.SETTLEMENT = ['batchid', 'settle_amount', 'settle_date', 'settle_markettype', 'settle_status'];
    exports.CCFIELDS = ['ccnumber', 'ccexp', 'ccv'];
    exports.CLICK2PAY = ['most_recent_open', 'number_opens', 'url'];
    exports.CCENTRY = _.concat(exports.CCFIELDS);
    exports.CODES = ['datetime','authcode', 'refid', 'error_status', 'done'];
    exports.ALLAUTH = _.concat(exports.CCENTRY,exports.CODES, exports.SETTLEMENT);
    exports.SERVICE_CREDENTIAL_FIELDS = ['custrecord_an_login', 'custrecord_an_login_sb', 'custrecord_an_trankey', 'custrecord_an_trankey_sb'];

    var RESPONSECODES = {
        "0" : "System Level Failure",
        "1" : "Approved",
        "2" : "Declined",
        "3" : "Error",
        "4" : "Held for Review",
    };
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
                    "code":"Service Connection Failure / Unable to communicate with Authorize.Net",
                    "text":"There was an issue establishing a connection from NetSuite to Authorize.Net<p>Confirm there is not a system outage for either platform and retry this transaction.</p><p>Often this is just a temporary issue and simply resubmitting the transaction will remove the error.</p>"
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
    //get getMerchantDetailsRequest for approved payment methods and account details
    exports.AuthNetGetMerchantDetailsRequest = function(o_ccAuthSvcConfig) {
        return {
            "getMerchantDetailsRequest": {
                "merchantAuthentication": o_ccAuthSvcConfig.auth
            }
        }
    };
    //get payment profile
    exports.AuthNetGetCustomerProfileRequest = {
        getCustomerProfileRequest: {
            "merchantAuthentication": {},
            "customerProfileId": null,
            "unmaskExpirationDate" : "true", //todo - should make this a parameter in the config for all exp date information
            "includeIssuerInfo": "true"
        }
    };

    var o_getSettledBatchListRequest = function(o_ccAuthSvcConfig){
        return {
            "getSettledBatchListRequest": {
                "merchantAuthentication": o_ccAuthSvcConfig.auth,
                "firstSettlementDate": '',
                "lastSettlementDate": ''
            }
        }
    }
    var o_getTransactionListRequest = function(o_ccAuthSvcConfig){
        return {
            "getTransactionListRequest": {
                "merchantAuthentication": o_ccAuthSvcConfig.auth,
                "batchId" : "",
                "sorting": {
                    "orderBy": "submitTimeUTC",
                    "orderDescending": "true"
                },
                "paging": {
                    "limit": "1000",
                    "offset": "1"
                }
            }
        }
    }
    var o_getUnsettledTransactionListRequest = function(o_ccAuthSvcConfig){
        return {
            "getUnsettledTransactionListRequest": {
                "merchantAuthentication": o_ccAuthSvcConfig.auth,
                "sorting": {
                    "orderBy": "submitTimeUTC",
                    "orderDescending": "true"
                },
                "paging": {
                    "limit": "1000",
                    "offset": "1"
                }
            }
        }
    }

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
    //thank you to Google for this delicious copy pasta
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    }
    //a object that can hold all the appropriate auth data in cache or in a field
    exports.cacheActiveConfig = function(){
        var live_solution = 'AAA175381';
        var s_companyId = '';
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
        var o_nsInstanceFeatures = config.load({ type: config.Type.FEATURES });
        _.forEach(a_configRecId, function (configId){
            var rec = record.load({
                type: 'customrecord_authnet_config',
                id: configId,
                isDynamic: false
            });
            //the response with the object components - placeholders to match those in subs
            var o_response = {
                id : rec.id,
                type: 1,
                mode: '',
                recType : rec.type,
                masterid: rec.id,
                configid : '',
                configname : rec.getValue({fieldId : 'name'}) + ' (MAIN CONFIG)',
                subid : '',
                //remember to add these below as well
                hasMultiSubRuntime : runtime.isFeatureInEffect({feature: 'multisubsidiarycustomer'}),
                hasPaymentInstruments : runtime.isFeatureInEffect({feature: 'paymentinstruments'}),
                hasNativeCC : o_nsInstanceFeatures.getValue({ fieldId: 'cctracking' }),
            };
            //set the general config for the integration
            s_companyId = _.toUpper(rec.getValue({fieldId : 'custrecord_an_instanceid'}));
            o_response.solutionId = {id : live_solution, name:'SuiteAuthConnect v.'+exports.VERSION};
            //undo the standard id with the development id's provided by Authorize.Net
            if (runtime.envType !== 'PRODUCTION' || _.startsWith(s_companyId, 'TSTDRV') || !rec.getValue('custrecord_an_islive'))
            {
                o_response.solutionId.id = _.sample(['AAA100302', 'AAA100303', 'AAA100304']);
                o_response.solutionId.name = 'SuiteAuthConnect (TESTING MODE) v.'+exports.VERSION;
            }
            var a_allFields = rec.getFields();
            var o_masterConfig = {};
            //log.debug('a_allFields', a_allFields)
            _.forEach(a_allFields, function(fld) {
                if (_.startsWith(fld, 'custrecord')) {
                    o_masterConfig[fld] = {
                        val: rec.getValue(fld),
                        txt: rec.getText(fld)
                    }
                }
            });
            //need to get the payment instrument ID which is different from the method id, thanks NS
            if (o_response.hasPaymentInstruments)
            {
                search.create({
                    type: 'paymentmethod',
                    filters: [
                        ['internalid', 'anyof',[o_masterConfig.custrecord_an_paymentmethod.val, o_masterConfig.custrecord_an_paymentmethod_echeck.val] ],
                    ],
                    columns: [
                        {name: 'name'},
                        {name: 'paymentoptionid'}
                    ]
                }).run().each(function (result) {
                    if (+o_masterConfig.custrecord_an_paymentmethod.val === +result.id)
                    {
                        o_masterConfig.custrecord_an_paymentmethod.profileId = result.getValue({name: 'paymentoptionid'});
                    }
                    else if (+o_masterConfig.custrecord_an_paymentmethod_echeck.val === +result.id)
                    {
                        o_masterConfig.custrecord_an_paymentmethod_echeck.profileId = result.getValue({name: 'paymentoptionid'});
                    }
                    return true;
                });
            }
            //ensure some of the universally needed values are at the top level
            var a_mandatoryTopLevelFields = [
                ''
            ];
            _.forEach(a_mandatoryTopLevelFields, function(fieldId){
                o_response[fieldId] = o_masterConfig[fieldId]
            });

            //these 4 fields from the main config are required for setting up a transaction before a sub is known
            o_response.custrecord_an_break_pci = o_masterConfig.custrecord_an_break_pci;
            o_response.custrecord_an_verbose_logging = o_masterConfig.custrecord_an_verbose_logging;
            o_response.custrecord_an_enable = o_masterConfig.custrecord_an_enable;
            o_response.custrecord_an_paymentmethod = o_masterConfig.custrecord_an_paymentmethod;
            o_response.custrecord_an_paymentmethod_echeck = o_masterConfig.custrecord_an_paymentmethod_echeck;

            //now build auth information off the sub records
            if (!rec.getValue({fieldId:'custrecord_an_all_sub'}))
            {
                o_response.mode = 'subsidiary';
                o_response.subs = {};
                search.create({
                    type: 'customrecord_authnet_config_subsidiary',
                    filters: [
                        ['custrecord_ancs_active', 'is', 'T'],
                        "AND",
                        ['custrecord_ancs_parent_config', 'anyof', [configId]]
                    ],
                    columns: [
                        'name'
                    ]
                }).run().each(function (subConfig) {
                    var subRec = record.load({
                        type: 'customrecord_authnet_config_subsidiary',
                        id: subConfig.id,
                        isDynamic: false
                    });
                    var o_thisSub = {
                        isSubConfig : true,
                        type: 1,
                        recType : rec.type,
                        masterid : rec.id,
                        configid : subConfig.id,
                        configname : subConfig.getValue('name'),
                        solutionId : o_response.solutionId,
                        subid : subRec.getValue('custrecord_ancs_subsidiary'),
                        subname : subRec.getText('custrecord_ancs_subsidiary'),
                        isReady : true,
                        hasMultiSubRuntime : runtime.isFeatureInEffect({feature: 'multisubsidiarycustomer'}),
                        hasPaymentInstruments : runtime.isFeatureInEffect({feature: 'paymentinstruments'}),
                        hasNativeCC : o_nsInstanceFeatures.getValue({ fieldId: 'cctracking' }),
                        liveAuth : true,
                        auth :{}
                    };
                    if (o_thisSub.hasMultiSubRuntime)
                    {
                        o_thisSub.ccnameprefix = subRec.getValue({fieldId:'custrecord_ancs_card_prefix'});
                        if (!o_thisSub.ccnameprefix)
                        {
                            o_thisSub.isReady = false;
                        }
                    }
                    o_response.solutionId = {id : live_solution, name:'SuiteAuthConnect v.'+exports.VERSION};
                    //undo the standard id with the development id's provided by Authorize.Net
                    if (runtime.envType !== 'PRODUCTION' || _.startsWith(s_companyId, 'TSTDRV') || !subRec.getValue('custrecord_ancs_islive'))
                    {
                        o_response.solutionId.id = _.sample(['AAA100302', 'AAA100303', 'AAA100304']);
                        o_response.solutionId.name = 'SuiteAuthConnect (TESTING MODE) v.'+exports.VERSION;
                    }

                    _.forEach(o_masterConfig, function(val, kie){
                        o_thisSub[kie] = val;
                    });
                    var a_allSubFields = subRec.getFields();
                    _.forEach(a_allSubFields, function(fld){
                        if (_.startsWith( fld, 'custrecord')) {
                            //rename the field to match the master config for max code reuse
                            var _renamed = fld.replace('_ancs_', '_an_');
                            o_thisSub[_renamed] = {
                                val: subRec.getValue(fld),
                                txt: subRec.getText(fld)
                            }
                        }
                    });
                    if (runtime.envType === 'PRODUCTION' && subRec.getValue({fieldId: 'custrecord_ancs_islive'})){
                        o_thisSub.auth.name = subRec.getValue({fieldId: 'custrecord_ancs_login'});
                        o_thisSub.auth.transactionKey = subRec.getValue({fieldId: 'custrecord_ancs_trankey'});
                        o_thisSub.authSvcUrl = rec.getValue({fieldId: 'custrecord_an_url'});

                    } else {
                        o_thisSub.auth.name = subRec.getValue({fieldId: 'custrecord_ancs_login_sb'});
                        o_thisSub.auth.transactionKey = subRec.getValue({fieldId: 'custrecord_ancs_trankey_sb'});
                        o_thisSub.authSvcUrl = rec.getValue({fieldId: 'custrecord_an_url_sb'});
                        o_thisSub.liveAuth = false;
                    }
                    o_response.subs['subid'+subRec.getValue({fieldId:'custrecord_ancs_subsidiary'})] = o_thisSub;
                    return true;
                });
            }
            else
            {
                o_response.mode = 'single';
                o_response.isSubConfig = false;
                o_response.liveAuth = true;
                o_response.auth = {};
                _.forEach(o_masterConfig, function(val, kie){
                    o_response[kie] = val;
                });
                //if no sub config - general auth object is built
                if (runtime.envType === 'PRODUCTION' && rec.getValue({fieldId: 'custrecord_an_islive'})){
                    o_response.auth.name = rec.getValue({fieldId: 'custrecord_an_login'});
                    o_response.auth.transactionKey = rec.getValue({fieldId: 'custrecord_an_trankey'});
                    o_response.authSvcUrl = rec.getValue({fieldId: 'custrecord_an_url'});
                } else {
                    o_response.auth.name = rec.getValue({fieldId: 'custrecord_an_login_sb'});
                    o_response.auth.transactionKey = rec.getValue({fieldId: 'custrecord_an_trankey_sb'});
                    o_response.authSvcUrl = rec.getValue({fieldId: 'custrecord_an_url_sb'});
                    o_response.liveAuth = false;
                }
            }

            a_cachedConfigs.push(o_response);
        });
        log.audit('The Authorize.Net Cache has been refreshed', 'This data should remain in cache for about an hour');
        //log.debug('a_cachedConfigs', a_cachedConfigs);
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
    exports.getConfigFromCache = function(txn) {
        var o_configResponse;
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
        if (o_fullCache[0]) {
            if (o_fullCache[0].mode === 'subsidiary' && txn) {
                //check for data type and make this smarter
                if (_.isObject(txn)) {
                    o_configResponse = o_fullCache[0].subs['subid' + txn.getValue({fieldId: 'subsidiary'})];
                } else {
                    o_configResponse = o_fullCache[0].subs['subid' + txn];
                }
            } else {
                o_configResponse = o_fullCache[0];
            }
        } else {
            o_configResponse = o_fullCache[0];
        }

        //this logging is highly annoying
        //log.debug('CACHE RETURN getConfigFromCache ('+txn+')', o_configResponse);
        //note the [0] above returns only one of the custom records - this is for multiple configs in the future
        return o_configResponse;
    };

    exports.getSubConfig = function(s_subId, o_config) {
        var o_specificConfig = o_config.subs['subid'+s_subId];
        if (o_specificConfig){
            log.audit('Available config '+o_specificConfig.configname, 'Using Subsidiary - ' +o_specificConfig.subname);
        }
        else
        {
            log.audit('No Subsidiary', 'Subsidiary id '+s_subId+' not configured');
        }
        return o_specificConfig;
    }

    exports.homeSysLog = function(name, body)
    {
        var o_config = this.getConfigFromCache();
        var b_singleScriptOverride = runtime.getCurrentScript().getParameter({name:'custscript_sac_debug_logs'}) === 'Y';
        if (o_config.custrecord_an_break_pci) {
            if (o_config.custrecord_an_break_pci.val || runtime.envType === runtime.EnvType.SANDBOX || b_singleScriptOverride) {
                if (runtime.envType === runtime.EnvType.PRODUCTION)
                {
                    log.debug('‼️ PCI ALERT!!! ‼️' + name, body);
                }
                else
                {
                    log.debug('‼️(⏳📦) ' + name, body);
                }
            }
        }
        else
        {
            log.emergency('CACHE ISSUE', 'The cache is incorrectly cached!')
        }
    };

    exports.verboseLogging = function(name, body)
    {
        var o_config = this.getConfigFromCache();

        if (o_config.custrecord_an_verbose_logging) {
            if (o_config.custrecord_an_verbose_logging.val || runtime.envType === runtime.EnvType.SANDBOX) {
                if (runtime.envType === runtime.EnvType.PRODUCTION)
                {
                    log.debug('🗣️🗣️🗣️' + name, body);
                }
                else
                {
                    log.debug('🗣️(⏳📦) ' + name, body);
                }
            }
        }
        else
        {
            log.emergency('CACHE ISSUE', 'The cache is incorrectly cached!')
        }
    };

    //Used for finding the success or failure history records for call to auth Net - excluding CIM calls

    exports.getHistory = function (o_req) {
        //{txnid : x, txntype : y, isOK : true, mostrecent : true}
        this.verboseLogging('getHistory()', 'txnid='+o_req.txnid+ ' txntype='+ o_req.txntype+ ' isOK='+ o_req.isOK+ ' mostrecent='+ o_req.mostrecent);
        var a_filters = [
            ['custrecord_an_txn', 'anyof', o_req.txnid],
            "AND",
            ['custrecord_an_cim_iscim', search.Operator.IS, false],
            "AND",

        ];
        if (o_req.txntype === 'customerrefund')
        {
            var a_subFilter = [
                ['custrecord_an_calledby', 'is', 'customerrefund'],
                "OR",
                ['custrecord_an_calledby', 'is', exports.normalizeRecType(o_req.txntype)],
                "OR",
                ['custrecord_an_calledby', 'is', 'depositapplication'],
            ];
            a_filters.push(a_subFilter);
        }
        else
        {
            a_filters.push(['custrecord_an_calledby', 'is', exports.normalizeRecType(o_req.txntype)])
        }
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

    /**
     * (TLDR; record fingerprint) What's a PBLKChain...  pseudo blockchain of course...  it's not a blockchain at all...  but blockchain is a fun word to say
     * @param cimRec
     *        {Object} netsuite loaded token record
     * @param id
     *        {number} internal id (weird, I know)
     *
     * @return {string} hash of the values to make a fingerprint
     *
     * @static
     * @function mkpblkchain
     */
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
            'undefined';
        //what's with the undefined - well - 100's of 1000's of tokens have been signed like this due to a typo - so - cleaned it up
        //these were added for echeck
        if (cimRec.getValue({fieldId : 'custrecord_an_token_bank_routingnumber'})){
            s_rawData += cimRec.getValue({fieldId : 'custrecord_an_token_bank_routingnumber'})
        }
        if (cimRec.getValue({fieldId : 'custrecord_an_token_bank_echecktype'})){
            s_rawData += cimRec.getValue({fieldId : 'custrecord_an_token_bank_echecktype'})
        }
        //note - I'd like to add custrecord_an_token_gateway_sub but you can't because all upgrades will invalidate tokens
        //should add an upgrade field in the upgrade process and then can add this
        s_rawData = s_rawData.replace(/\s/g, "");
        var hashObj = crypto.createHash({
            algorithm: crypto.HashAlg.SHA512
        });
        hashObj.update({
            input: s_rawData
        });
        return hashObj.digest({
            outputEncoding: encode.Encoding.HEX
        });
    };


    /*
    * Call to find any matching payment profiles for a customer to prevent duplication
    *
    */
    exports.findExistingProfile = function (customerId, profileId, paymentId) {//internalid of customer, profile ID, payment ID
        this.verboseLogging('findExistingProfile parameters are: customerId, profileId, paymentId ', customerId +', '+ profileId +', '+  paymentId);
        var a_filters = [
            ['custrecord_an_token_entity', search.Operator.ANYOF, customerId],
            "AND",
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

    exports.parseHistory = function (txnid, txntype, b_isAuthNet) {
        var o_parsedHistory = {isAuthNetTransaction : b_isAuthNet, isValid : false, status : 'ERROR', message : ''};
        //would be undefined on a create that triggers this due to logic issue or on a copy or the transformation where there is no history but the record has some field set indicating there MIGHT be history
        this.verboseLogging('parseHistory() '+txnid + ' : ' + txntype, _.isUndefined(txnid) +','+ _.isUndefined(txntype) + ', is this authnet? '+ b_isAuthNet);
        if (_.isNull(txnid) || _.isNull(txntype) || !o_parsedHistory.isAuthNetTransaction){
            o_parsedHistory.isValid = true;
            o_parsedHistory.status = 'OK';
        } else {
            var historyRec = this.getHistory({'txnid': txnid, 'txntype': txntype, 'isOK': false, 'mostrecent': true});
            if (_.isObject(historyRec)) {
                o_parsedHistory = {
                    showBanner : _.toUpper(historyRec.getValue({fieldId: 'custrecord_an_response_status'})) === 'ERROR',
                    isValid: _.toUpper(historyRec.getValue({fieldId: 'custrecord_an_response_status'})) === 'OK',
                    historyId : historyRec.id,
                    status: historyRec.getValue({fieldId: 'custrecord_an_response_status'}),
                    responseCode: historyRec.getValue({fieldId: 'custrecord_an_response_code'}),
                    responseCodeText : RESPONSECODES[historyRec.getValue({fieldId: 'custrecord_an_response_code'})] ? RESPONSECODES[historyRec.getValue({fieldId: 'custrecord_an_response_code'})] : 'Authorize.Net Warning',
                    errorCode: historyRec.getValue({fieldId: 'custrecord_an_error_code'}),
                    message: ''
                };
                if (historyRec.getValue({fieldId: 'custrecord_an_response_code'}) === '4')
                {
                    o_parsedHistory.showBanner = true;
                    var historyUrl = url.resolveRecord({
                        recordType: 'customrecord_authnet_history',
                        recordId: historyRec.id,
                        isEditMode: false
                    });
                    o_parsedHistory.message = 'This transaction is on a fraud review hold - you must approve or reject from the fraud hold on the history record on this transaction <a target="_blank" href="'+historyUrl+'">here</a>.  Additional details pertaining to the fraud hold may be found in your Authorize.Net account.<br />'
                }

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
                o_parsedHistory.message = 'This transaction did not log any Authorize.Net call. (c9)'
            }
        }
        return o_parsedHistory;
    };
        /**
         * Calcuate the records that need refunds issues off a customer refund
         * @param orgtxn
         *        {Object} netsuite loaded customer refund
         * @param obj
         *        {Array} list of object representing the transactions to be refunded
         *
         * @return {Object}results from exports.performBulkRefunds()
         *
         * @static
         * @function getBulkRefunds
         */
    exports.getBulkRefunds = function (orgtxn, obj){
        this.verboseLogging('getBulkRefunds(obj)', obj);
        //this.verboseLogging('getBulkRefunds(orgtxn)', orgtxn);
        //loop through object
        //search ID's for transaction types, date / time created
        //log.debug('??', _.map(obj, 'id'))
        var a_filters = [
            ['internalid', 'anyof', _.map(obj, 'id')],
            "AND",
            ["mainline","is","T"],
        ];
        if (obj.length === 1)
        {
            if (obj[0].applyType === "Credit Memo")
            {
                a_filters.push('AND');
                a_filters.push(["appliedToTransaction.internalid","anyof",obj[0].from]);
            }
        }
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
                {name:"custbody_authnet_refid", join:"appliedToTransaction"},
                {name:"internalid", join:"appliedToTransaction"},
                {name:"tranid", join:"appliedToTransaction"},
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
            };
            if (resultObj.type === 'DepAppl') {
                resultObj.anetRefId = result.getValue({name:"custbody_authnet_refid", join:"appliedToTransaction"});
            } else {
                resultObj.anetRefId = result.getValue({name : 'custbody_authnet_refid'});
            }
            resultObj.amount = _.find(obj, {id:resultObj.id}).amount;
            //exports.homeSysLog('resultObj', resultObj)
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
        this.verboseLogging('a_aNetFilters',a_aNetFilters);
        var authNetRecs = search.create({
            type: 'customrecord_authnet_history',
            filters: a_aNetFilters,
            columns: [
                {name: 'internalid'},
                {name: 'custrecord_an_refid'},
                {name: 'custrecord_an_card_type'},
                {name: 'custrecord_an_txn'},
                {name: 'custrecord_an_cardnum'},
                {name: 'created'},
                {name: 'custrecord_an_sub_config'},
                {name: 'custrecord_ancs_subsidiary', join : 'custrecord_an_sub_config'},
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
            exports.verboseLogging('authNetRecs.each as o_aNet', o_aNet);
            return true;
        });
        this.verboseLogging('processable records', a_toProcess);
        return this.performBulkRefunds(orgtxn, a_toProcess);
    };

    exports.getRefund = function (txn) {
        log.audit('getRefund. 3rd Party Call', 'getRefund()');
        var o_ccAuthSvcConfig = this.getConfigFromCache(txn);
        this.verboseLogging('getRefund.getConfig is ', o_ccAuthSvcConfig.type);
        return callRefund[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    exports.doVoid = function (txn) {
        log.audit('doVoid. 3rd Party Call', 'doVoid()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache(txn);
        this.verboseLogging('doVoid.getConfig is ', o_ccAuthSvcConfig.type);
        return callVoid[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    exports.doFraudApprove = function (historyRec, txn, s_approval) {
        log.audit('doFraudApprove. 3rd Party Call', 'doFraudApprove()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache(txn);
        this.verboseLogging('doFraudApprove.getConfig is ', o_ccAuthSvcConfig.type);
        return callFraud[o_ccAuthSvcConfig.type](historyRec, txn, o_ccAuthSvcConfig, s_approval);
    };
    exports.getAuth = function (txn) {
        log.audit('getAuth. 3rd Party AUTH Call', 'getAuth()');
        //by passing the txn, we get the right config!
        var o_ccAuthSvcConfig = this.getConfigFromCache(txn);
        this.verboseLogging('getAuth.getConfig is ', o_ccAuthSvcConfig.type);
        return callAuth[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    exports.getStatus = function (txn, s_callType) {
        log.audit('getTxnStatus. 3rd Party Status Call', 'getStatus()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache(txn);
        this.verboseLogging('getAuth.getStatus is ', o_ccAuthSvcConfig.type);
        return getTxnStatus[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig, s_callType);
    };
    exports.getStatusCheck = function (tranid, configId) {
        log.audit('getCallStatus. 3rd Party Status Call', 'getCallStatus()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache();
        //log.debug('getAuth.getConfig is ', o_ccAuthSvcConfig.type);
        return doCheckStatus[o_ccAuthSvcConfig.type](o_ccAuthSvcConfig,tranid,configId);
    };
    exports.getAuthCapture = function (orgtxn) {
        log.audit('getAuthCapture. 3rd Party AUTH Call', 'getAuthCapture()');
        var txn = record.load({
            type : orgtxn.type,
            id: orgtxn.id,
            isDynamic: true });
        var o_ccAuthSvcConfig = this.getConfigFromCache(txn);
        this.verboseLogging('getAuthCapture.getConfig is ', o_ccAuthSvcConfig.type);
        return callAuthCapture[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    exports.doCapture = function (txn) {
        log.audit('doCapture. 3rd Party Call', 'doCapture()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache(txn);
        this.verboseLogging('doCapture.getConfig is ', o_ccAuthSvcConfig.type);
        return callCapture[o_ccAuthSvcConfig.type](txn, o_ccAuthSvcConfig);
    };
    /**
     * @param txn
     *        {Object} loaded transaction
     * @param config
     *        {Object} core config Object
     *
     * @return {Object} Built token response
     *
     * @static
     * @function getCIM
     */
    exports.getCIM = function (txn, config) {
        log.audit('getCIM. calling AUTH.Net', 'getCIM()');
        if (config.mode === 'subsidiary')
        {
            config = this.getSubConfig(txn.getValue({fieldId: 'subsidiary'}), config)
        }
        var o_profile = mngCustomerProfile.createProfileFromTxn(txn, config);
        var o_tokenResponse;
        if (o_profile.success){
            o_tokenResponse = mngCustomerProfile.getAndBuildProfile(o_profile, config);
        }
        return o_tokenResponse;
    };

    exports.createNewProfile = function (o_profile, filteredConfig) {
        log.audit('requestNewToken. building AUTH.Net', 'requestNewToken()');
        return mngCustomerProfile.createNewProfile(o_profile, filteredConfig);
    };

    exports.getProfileByNSeId = function (nseid, config) {
        log.audit('requestNewToken. building AUTH.Net', 'looking for existing profile for this customer ()');
        return mngCustomerProfile.getProfileByNSeId(nseid, config);
    };

    exports.makeToken = function (o_profile, config) {
        log.audit('makeToken. building AUTH.Net', 'makeToken()');
        return mngCustomerProfile.getAndBuildProfile(o_profile, config);
    };

    exports.importCIMToken = function (o_importedJSON) {
        log.audit('importCIMToken. building AUTH.Net', 'importCIMToken()');
        return mngCustomerProfile.importProfile(o_importedJSON);
    };

    exports.importAndBuildProfilesOffProfileId = function (o_importedJSON) {
        log.audit('importAndBuildProfilesOffProfileId. building AUTH.Net', 'importAndBuildProfilesOffProfileId()');
        return mngCustomerProfile.importAndBuildProfilesOffProfileId(o_importedJSON);
    };

    exports.doSettlement = function (txn, settlementType) {
        log.audit('doSettlement. Direct Call', 'doSettlement()');
        //var o_ccAuthSvcConfig = getConfig(txn);
        var o_ccAuthSvcConfig = this.getConfigFromCache(txn);
        this.verboseLogging('doSettlement.getConfig.settlementType is ', o_ccAuthSvcConfig.type);
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

    exports.getSettledBatchListRequest = function (d_start, d_end, subConfigId) {
        log.audit('getSettledBatchListRequest. 3rd Party Status Call', 'getSettledBatchListRequest('+subConfigId+')');
        var o_ccAuthSvcConfig = this.getConfigFromCache(subConfigId);
        this.verboseLogging('o_ccAuthSvcConfig', o_ccAuthSvcConfig)
        return getSettledBatchListRequest(o_ccAuthSvcConfig, d_start, d_end);
    };
    exports.getTransactionListRequest = function (batchId, subConfigId) {
        log.audit('getTransactionListRequest. 3rd Party Status Call', 'getTransactionListRequest()');
        var o_ccAuthSvcConfig = this.getConfigFromCache(subConfigId);
        return getTransactionListRequest(o_ccAuthSvcConfig, batchId);
    };


    exports.handleResponse = function(response, context, doDelete){
        //the bulk refunds return an array of responses - so we are just gonna act on the first one -
        if(_.isArray(response)) {
            response = response[0]
        }
        if(response.status){
            response.txn.save({ignoreMandatoryFields : true});
        } else {
            redirect.toSuitelet({
                scriptId: 'customscript_c9_authnet_screen_svc' ,
                deploymentId: 'customdeploy_sac_authnet_screen_svc',
                parameters: {
                    orgid : response.fromId,
                    from : context.newRecord.type,
                    fromId : context.newRecord.id,
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
    exports.makeIntegrationHistoryRec = function(txn, config, o_status){
        var b_isValid = true;
        if (config.custrecord_an_validate_external_txn.val){
            b_isValid = exports.getStatus(txn);
        } else {
            var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
            rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: config.masterid});
            rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: config.configid});
            rec_response.setValue('custrecord_an_txn', txn.id);
            rec_response.setValue('custrecord_an_calledby', txn.type);
            rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
            //todo fix this to read for payload
            rec_response.setValue('custrecord_an_call_type', o_status.fullResponse.transactionType);
            //todo - setting for webstore of auth or authcapture
            rec_response.setValue('custrecord_an_amount', getBaseCurrencyTotal(txn));
            rec_response.setValue('custrecord_an_reqrefid', txn.getValue({fieldId : config.custrecord_an_external_fieldid.val}));
            rec_response.setValue('custrecord_an_refid', o_status.fullResponse.transId);
            rec_response.setValue('custrecord_an_response_code', o_status.fullResponse.responseCode);
            if (o_status.fullResponse.responseCode === 1)
            {
                rec_response.setValue('custrecord_an_response_status', 'Ok');
                rec_response.setValue('custrecord_an_response_message', 'This transaction is assumed valid and authorized prior to integration with NetSuite.');
            }
            else
            {
                rec_response.setValue('custrecord_an_response_status', 'Error');
            }
            rec_response.setValue('custrecord_an_response_ig_other', 'Date Created is NOT the timestamp for the event, that is when the record was sent to NetSuite');
            rec_response.save({ignoreMandatoryFields : true});
        }
        return b_isValid;
    };

        //build a history record and return the stubbed out record when using EXTERNAL AUTH
        /*exports.fixIntegrationHistoryRec = function(txn, config){
            var o_response = {b_isValid : true, histRecId:''};
            var o_status = exports.getStatusCheck(txn.getValue({fieldId: 'custbody_authnet_refid'}));
            if (txn.type === 'customerdeposit' && (o_status.transactionStatus === 'capturedPendingSettlement' || o_status.transactionStatus === 'settledSuccessfully')) {
                var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
                rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: config.masterid});
                rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: config.configid});
                rec_response.setValue('custrecord_an_txn', txn.id);
                rec_response.setValue('custrecord_an_calledby', txn.type);
                rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity') : txn.getValue('customer'));
                rec_response.setValue('custrecord_an_call_type', o_status.fullResponse.transactionType);
                rec_response.setValue('custrecord_an_amount', getBaseCurrencyTotal(txn));
                rec_response.setValue('custrecord_an_reqrefid', o_status.fullResponse.order.invoiceNumber);
                rec_response.setValue('custrecord_an_refid', o_status.fullResponse.transId);
                rec_response.setValue('custrecord_an_response_status', 'Ok');
                rec_response.setValue('custrecord_an_response_message', 'This transaction is assumed valid and authorized prior to integration with NetSuite.');
                rec_response.setValue('custrecord_an_response_code', o_status.fullResponse.responseCode);
                rec_response.setValue('custrecord_an_response_ig_other', 'Date Created is NOT the timestamp for the event, that is when the record was sent to NetSuite');
                o_response.histRecId = rec_response.save({ignoreMandatoryFields: true});
            }
            return o_response;
        };*/

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
                //log.error('cleanAuthNet . ', txn.type + ' missing ' + fld)
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
                    //log.error('cleanAuthNet . doall', txn.type + ' missing ' + fld)
                }
            });
        }
        return txn;
    };

    getBaseCurrencyTotal = function(txn, amt){
        exports.homeSysLog('getBaseCurrencyTotal txn total : ' + txn.getValue('total'), amt);
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
        exports.homeSysLog('getBaseCurrencyTotal returning f_total', f_total);
        return f_total.toString();
    };

    exports.historyParseTester = function(histRec, txnRec, response){
        return parseANetResponse(histRec, txnRec, response);
    };

    //UPDATED on 7/1/2019
    //and again on 11/11/2022 - to understand fraud as best as we can...
    parseANetResponse = function(histRec, txnRec, response, o_config)
    {
        var result = {
            status : true
        };
        var o_body = JSON.parse(response.body.replace('\uFEFF', ''));
        //exports.homeSysLog('parseANetResponse()', o_body);
        histRec.setValue('custrecord_an_txn', txnRec.id);
        histRec.setValue('custrecord_an_customer', _.isEmpty(txnRec.getText('customer')) ? txnRec.getValue('entity'): txnRec.getValue('customer'));
        histRec.setValue('custrecord_an_response', JSON.stringify(o_body));
        exports.verboseLogging('parseANetResponse response : '+response.code, response.body);
        if (response.code === 200){
            var messages = '';
            var s_suggestion = '', s_otherSuggestions = '', a_errorCodes = [];
            //some resononses have some data based on the TYPE of failure
            if(!_.isUndefined(o_body.transactionResponse)){
                var o_respObj = _.find(codes.anetCodes, {'code':o_body.transactionResponse.responseCode});
                //('o_respObj', o_respObj)
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
                if (o_respObj) {
                    histRec.setValue('custrecord_an_response_code', o_respObj.code);
                    histRec.setValue('custrecord_an_response_code_type', RESPONSECODES[o_respObj.code]);
                    if (_.includes([1, 4], +o_respObj.code)) //see RESPONSECODES for these
                    {
                        histRec.setValue('custrecord_an_response_status', 'Ok');
                    }
                    else
                    {
                        histRec.setValue('custrecord_an_response_status', 'Error');
                        if (_.isArray(o_body.transactionResponse.errors)) {
                            _.forEach(o_body.transactionResponse.errors, function (error) {
                                //histRec.setValue({fieldId: 'custrecord_an_error_code', value: error.errorCode});
                                a_errorCodes.push(error.errorCode);
                                var errorObj = _.find(codes.anetCodes, {'code': error.errorCode});
                                if (error.errorCode === '11') {
                                    s_suggestion = 'A transaction with identical amount and credit card information was submitted within the previous two minutes.<br>You should remove this event from the listing under "Authorize.net History" as this transactions was successfully charged already';
                                } else {
                                    s_suggestion += errorObj.integration_suggestions.replace(/&lt;br\/&gt;/g, '<br/>').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                                }
                                s_otherSuggestions += errorObj.other_suggestions.replace(/&lt;br\/&gt;/g, '<br/>').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
                            });
                        }
                        histRec.setValue({fieldId: 'custrecord_an_error_code', value: a_errorCodes.toString()});
                        histRec.setValue('custrecord_an_response_ig_advice', s_suggestion);
                        histRec.setValue('custrecord_an_response_ig_other', s_otherSuggestions);
                        if (!_.isUndefined(o_body.transactionResponse.refTransID)) {
                            histRec.setValue('custrecord_an_refid', o_body.transactionResponse.refTransID);
                        }
                    }
                }
                else
                {
                    //log.debug('whats the o_body', o_body)
                    histRec.setValue('custrecord_an_response_status', 'Error');
                    if (_.isArray(o_body.transactionResponse.errors)) {
                        _.forEach(o_body.transactionResponse.errors, function (error) {
                            //histRec.setValue({fieldId: 'custrecord_an_error_code', value: error.errorCode});
                            a_errorCodes.push(error.errorCode);
                            var errorObj = _.find(codes.anetCodes, {'code': error.errorCode});
                            if (error.errorCode === '11') {
                                s_suggestion = 'A transaction with identical amount and credit card information was submitted within the previous two minutes.<br>You should remove this event from the listing under "Authorize.net History" as this transactions was successfully charged already';
                            } else {
                                s_suggestion += errorObj.integration_suggestions.replace(/&lt;br\/&gt;/g, '<br/>').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                            }
                            s_otherSuggestions += errorObj.other_suggestions.replace(/&lt;br\/&gt;/g, '<br/>').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
                        });
                    }
                    if(o_body.messages) {
                        if (_.isArray(o_body.messages.message)) {
                            _.forEach(o_body.messages.message, function (error) {
                                log.error('Response Error', error.code + ' : '+ error.message);
                                histRec.setValue({fieldId: 'custrecord_an_response_code', value: error.code});
                                s_suggestion += error.text;
                                a_errorCodes.push(error.code);
                                var errorObj = _.find(codes.anetCodes, {'code': error.code});
                                if (error.code === '11') {
                                    s_suggestion = 'A transaction with identical amount and credit card information was submitted within the previous two minutes.<br>You should remove this event from the listing under "Authorize.net History" as this transactions was successfully charged already';
                                } else {
                                    s_suggestion += errorObj.integration_suggestions.replace(/&lt;br\/&gt;/g, '<br/>').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                                }
                                s_otherSuggestions += errorObj.other_suggestions.replace(/&lt;br\/&gt;/g, '<br/>').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
                            });
                        }
                    }
                    histRec.setValue({fieldId: 'custrecord_an_error_code', value: a_errorCodes.toString()});
                    histRec.setValue('custrecord_an_response_ig_advice', s_suggestion);
                    histRec.setValue('custrecord_an_response_ig_other', s_otherSuggestions);
                    if (!_.isUndefined(o_body.transactionResponse.refId)) {
                        histRec.setValue('custrecord_an_refid', o_body.refId);
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
                else if (!_.isUndefined(o_body.messages)){
                    _.forEach(o_body.messages.message, function(error){
                        messages += error.text + ' '
                    });
                }
                histRec.setValue('custrecord_an_response_message', _.truncate(messages, {'length': 299}));
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
                    histRec.setValue({fieldId : 'custrecord_an_response_message', value : _.truncate(message.text, {'length': 299})});
                    histRec.setValue({fieldId : 'custrecord_an_response_ig_advice', value : s_suggestion});
                    histRec.setValue({fieldId : 'custrecord_an_response_ig_other', value :s_otherSuggestions});
                    histRec.setValue({fieldId : 'custrecord_an_reqrefid', value : txnRec.id});
                });
            }
            else
            {
                histRec.setValue('custrecord_an_response_status', 'Error');
            }
            if(_.toUpper(histRec.getValue('custrecord_an_response_status')) === 'OK')
            {
                if(o_body.transactionResponse.accountType === 'eCheck')
                {
                    txnRec.setValue('custbody_authnet_authcode', 'eCheck');
                }
                else
                {
                    txnRec.setValue('custbody_authnet_authcode', o_body.transactionResponse.authCode);
                }
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
        log.audit('Building the transaction', 'Generating Authorize.Net order body payload!');
        try {
            request.order = {};
            request.order.invoiceNumber = txn.getValue({fieldId: 'tranid'});
            if (txn.getValue({fieldId: 'salesorder'})) {
                txn = record.load({
                    type: 'salesorder',
                    id: txn.getValue({fieldId: 'salesorder'}),
                    isDynamic: true
                });
            }
            var s_customer = '';
            try {
                s_customer = txn.getText({fieldId: 'entity'}) ? txn.getText({fieldId: 'entity'}) : txn.getText({fieldId: 'customer'});
            } catch (e) {
                exports.homeSysLog('generateANetTransactionRequestJSON(s_suctomer)', s_customer);
            }
            if (exports.getConfigFromCache().mode === 'subsidiary') {
                request.order.description = s_customer + ' ' + txn.type + ' from ' + exports.getConfigFromCache(txn.getValue({fieldId: 'subsidiary'})).custrecord_an_txn_companyname.val;
            } else {
                request.order.description = s_customer + ' ' + txn.type + ' from ' + exports.getConfigFromCache().custrecord_an_txn_companyname.val;
            }
            //enhanced field data
            //todo - on payment - look back at invoice / invoices for apply lines (see lookup below)
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
                //adding logic for item type because negative discounts cause an issue when the rate is a percent
                //these things have no quantity - which matters later too
                var _lineQty = txn.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i}).toString();
                var b_isItem = !_.isEmpty(_lineQty);
                var unitPrice = '0', s_lineQuantity = '1';
                if (b_isItem) {
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
                    'unitPrice': Math.abs(unitPrice).toFixed(2),
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
            //todo - make this search less and get everything if it's a direct in the address search!
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
            //because deposits and payments dont have addresses - we need to go look it up!
            //log.debug('txn.type', txn.type)
            if (_.includes(['customerdeposit', 'customerpayment'], txn.type ))
            {
                var a_addrTxnIds = [];
                if (txn.type === 'customerpayment')
                {
                    for(var i = 0; i < txn.getLineCount({sublistId:'apply'}); i++)
                    {
                        //log.debug('line '+i, txn.getSublistValue({sublistId:'apply', fieldId:'apply', line :i}))
                        if (txn.getSublistValue({sublistId:'apply', fieldId:'apply', line :i}))
                        {
                            a_addrTxnIds.push(txn.getSublistValue({sublistId:'apply', fieldId:'internalid', line :i}));
                        }
                    }
                }
                else if (txn.type ==='customerdeposit')
                {
                    a_addrTxnIds.push(txn.getValue({fieldId : 'salesorder'}));
                }
                //deposit is cretadfrom
                //payment is "get the invoices"
                a_addrTxnIds = _.pullAll(a_addrTxnIds, ['']);
                if (a_addrTxnIds.length > 0) {
                    search.create({
                        type: 'transaction',
                        filters: [
                            ['type', 'anyof', ['CustInvc', 'SalesOrd']],
                            "AND",
                            ['internalid', 'anyof', a_addrTxnIds],
                            "AND",
                            ['mainline', 'is', true],
                        ],
                        columns:
                            [
                                'shipaddressee',
                                'shipaddress1',
                                'shipcity',
                                'shipstate',
                                'shipzip',
                                'shipcountry',
                            ]
                    }).run().each(function (result) {
                        //log.debug('result', result);
                        var a_shipToName = result.getValue('shipaddressee');
                        if (a_shipToName) {
                            a_shipToName = result.getValue('shipaddressee').split(' ');
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
                        o_shippingAddress.address = result.getValue('shipaddress1');
                        o_shippingAddress.city = result.getValue('shipcity');
                        o_shippingAddress.state = result.getValue('shipstate');
                        o_shippingAddress.zip = result.getValue('shipzip');
                        o_shippingAddress.country = result.getValue('shipcountry');
                        request.shipTo = o_shippingAddress;
                    });
                }
            }
            else
            {
                //Shipping Address Logic
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
                var shippingSub;
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
        }
        catch (ex)
        {
            if (ex.name){
                throw 'Something very unexpected happened in the building of the message to Authorize.net and this transaction <span style="color:red;font-weight:bold;">has NOT been sent to Authorize.Net</span> <br/><br/>' +
                ex.name +' : '+ ex.message
                + '<br/><br/><br/><br/>Send this to a nerd to fix things:<br/><br/>' +
                ex.stack;
            }
            else
            {
                throw 'Something very unexpected happened in the building of the message to Authorize.net and this transaction <span style="color:red;font-weight:bold;">has NOT been sent to Authorize.Net</span> <br/><br/>' + ex;
            }
        }
    };
        /**
         * @param o_test
         *        {Object} test object {url: <target api>} ,
         *                                 type: 'sandbox',
         *                                 auth: {
         *                                     name: <value>,
         *                                     transactionKey: <value>
         *                                 }
         *
         * @return {Object} response object {isValid : bool,
         * title : text,
         * level : banner level,
         * message : text
         * }
         *
         * @static
         * @function doTest
         */
        exports.doTest = function (o_test) {
            log.audit('doTest. 3rd Party Status Call', 'doTest()');
            var o_authTestObj = {isValid : false, type : o_test.type, title : _.toUpper(o_test.type) + ' Authorize.Net connection failed'};
            this.verboseLogging('doTest o_test', o_test);
            exports.AuthNetTest.authenticateTestRequest.merchantAuthentication = o_test.auth;
            this.homeSysLog('doTest request', exports.AuthNetTest);
            try {
                var response = https.post({
                    headers: {'Content-Type': 'application/json'},
                    url: o_test.url,
                    body: JSON.stringify(exports.AuthNetTest)
                });
                this.homeSysLog('doTest response.body', response.body);
                var o_body = JSON.parse(response.body.replace('\uFEFF', ''));
                if (o_body.messages){
                    if (o_body.messages.resultCode === 'Ok'){
                        o_authTestObj.isValid = true;
                        o_authTestObj.title = _.toUpper(o_test.type) + ' <> Authorize.Net connection successful';
                        o_authTestObj.level = message.Type.CONFIRMATION;
                        o_authTestObj.message = 'SuiteAuthConnect has successfully connected to Authorize.Net in '+ _.toUpper(o_test.type) + ' mode.';
                    } else {
                        o_authTestObj.message = o_body.messages.message[0].text + ' ('+o_body.messages.message[0].code+')';
                        o_authTestObj.level = message.Type.ERROR;
                    }
                } else {
                    o_authTestObj.message = JSON.stringify(o_body);
                    o_authTestObj.level = message.Type.ERROR;
                }
            } catch (e) {
                log.error(e.name, e.message);
                log.error(e.name, e.stack);
                o_authTestObj.message = e.name + ' : '+ e.message;
                o_authTestObj.level = message.Type.ERROR;
            }
            return o_authTestObj;
        };

    var getTxnStatus = {};
    getTxnStatus[1] = function (txn, o_ccAuthSvcConfig, s_callType){
        //check for format and type to ensure authnet
        //do not do anything if this is not a valid authnet transaction to validate
        if (
            !txn.getValue({fieldId : 'custbody_authnet_refid'})
        ||
            (txn.getValue({fieldId : 'custbody_authnet_settle_status'}) && txn.getValue({fieldId : 'custbody_authnet_settle_status'}))
        )
        {
            return true;
        }
        var b_canContinue = true;
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl;
        exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.transId = txn.getValue({fieldId : 'custbody_authnet_refid'});
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
        rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
        rec_response.setValue('custrecord_an_txn', txn.id);
        rec_response.setValue('custrecord_an_calledby', txn.type);
        rec_response.setValue('custrecord_an_refid', txn.getValue({fieldId:'custbody_authnet_refid'}));
        rec_response.setValue('custrecord_an_reqrefid', txn.getValue({fieldId:o_ccAuthSvcConfig.custrecord_an_external_fieldid.val}));
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
                rec_response.setValue({fieldId: 'custrecord_an_response', value : JSON.stringify(o_body.transaction)});
                if (+o_body.transaction.responseCode === 1){
                    rec_response.setValue({fieldId: 'custrecord_an_response_status', value : 'Ok'});
                } else {
                    rec_response.setValue({fieldId: 'custrecord_an_response_status', value: 'Error'});
                    b_canContinue = false;
                }
                if (s_callType)
                {
                    rec_response.setValue({fieldId: 'custrecord_an_call_type', value : s_callType});
                }
                else
                {
                    rec_response.setValue({fieldId: 'custrecord_an_call_type', value : o_body.transaction.transactionType});
                }
                if (o_body.transaction.transactionStatus === 'settledSuccessfully')
                {
                    rec_response.setValue({fieldId: 'custrecord_an_settle_status', value : o_body.transaction.transactionStatus });
                }
                rec_response.setValue({fieldId: 'custrecord_an_amount', value : o_body.transaction.authAmount});
                rec_response.setValue({fieldId: 'custrecord_an_error_code', value : o_body.transaction.responseReasonCode});
                rec_response.setValue({fieldId: 'custrecord_an_response_code', value : o_body.transaction.responseCode});
                rec_response.setValue({fieldId: 'custrecord_an_avsresultcode', value : o_body.transaction.AVSResponse});
                rec_response.setValue({fieldId: 'custrecord_an_cvvresultcode', value : o_body.transaction.cardCodeResponse});
                rec_response.setValue({fieldId: 'custrecord_an_card_type', value : o_body.transaction.payment.cardType});
                rec_response.setValue({fieldId: 'custrecord_an_cardnum', value : o_body.transaction.payment.cardNumber});
                rec_response.setValue({fieldId: 'custrecord_an_response_message', value : o_body.transaction.transactionStatus });
                rec_response.setValue({fieldId: 'custrecord_an_response_ig_other', value : o_body.transaction.responseReasonDescription });
                rec_response.setValue({fieldId: 'custrecord_an_refid', value : o_body.transaction.transId});

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
                rec_response.setValue({fieldId: 'custrecord_an_reqrefid', value: o_body.transrefId});


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
            rec_response.save({ignoreMandatoryFields : true});
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
    doCheckStatus[1] = function (o_ccAuthSvcConfig, tranid, configId)
    {
        exports.homeSysLog('ALL o_ccAuthSvcConfig',o_ccAuthSvcConfig);
        if (configId)
        {
            o_ccAuthSvcConfig = _.find(o_ccAuthSvcConfig.subs, {"configid":configId.toString()})
        }
        else if (o_ccAuthSvcConfig.mode === 'subsidiary')
        {
            //need to get the sub of this transaction and then swap the config to that sub
            search.create({
                type: 'customrecord_authnet_history',
                filters: [
                    ['custrecord_an_refid', 'is', tranid],
                    "AND",
                    ['custrecord_an_cim_iscim', 'is', 'F'],
                ],
                columns: [
                    {join: 'custrecord_an_txn', name : 'internalid', sort : search.Sort.DESC},
                    {name: 'name'},
                    {name: 'custrecord_an_parent_config'},
                    {name: 'custrecord_an_sub_config'},
                    {join: 'custrecord_an_sub_config', name: 'custrecord_ancs_subsidiary'},
                ]
            }).run().each(function (result) {
                if (!result.getValue('custrecord_an_sub_config'))
                {
                    log.audit('Need to find the transaction!', 'History logs were not found.');
                    search.create({
                        type: 'transaction',
                        filters: [
                            ['custbody_authnet_refid', 'is', tranid],
                            "AND",
                            ['mainline', 'is', 'T'],
                        ],
                        columns: [
                            {name: 'tranid'},
                            {name: 'subsidiary'}
                        ]
                    }).run().each(function (result) {
                        o_ccAuthSvcConfig = exports.getSubConfig(result.getValue('subsidiary'), o_ccAuthSvcConfig);
                    });
                }
                else
                {
                    log.audit('Matched config '+ result.getText('custrecord_an_sub_config'),  'Loading config for subsidiary '+ result.getText({join: 'custrecord_an_sub_config', name: 'custrecord_ancs_subsidiary'}));
                    o_ccAuthSvcConfig = exports.getSubConfig(result.getValue({join: 'custrecord_an_sub_config', name: 'custrecord_ancs_subsidiary'}), o_ccAuthSvcConfig);
                }
            });

        }
        exports.homeSysLog('USING o_ccAuthSvcConfig',o_ccAuthSvcConfig);
        var o_summaryStatus = {isValidAuth : false};
        exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.transId = tranid;
        exports.homeSysLog('calling doCheckStatus with '+tranid, exports.AuthNetGetTxnStatus);
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(exports.AuthNetGetTxnStatus)
            });
            exports.homeSysLog('doStatusCheck getTxnStatus response.body', response.body);
            var o_body = JSON.parse(response.body.replace('\uFEFF', ''));
            //log.debug('o_body', o_body)
            if (o_body.transaction){
                o_summaryStatus.transactionStatus = o_body.transaction.transactionStatus;
                o_summaryStatus.fullResponse = o_body.transaction;
                if (+o_body.transaction.responseCode !== 1){
                    o_summaryStatus.isValidAuth = false;
                }
                else
                {
                    o_summaryStatus.isValidAuth = true;
                }
                //anything can be added ro the response as this is used more
            } else {
                if (o_body.messages) {
                    o_summaryStatus.isValidAuth = false;
                    o_summaryStatus.messages = o_body.messages;
                }
            }
        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
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
        //3.2.11 - add field in configs to add a percent to the total
        //log.debug('PCT markup', o_ccAuthSvcConfig.custrecord_an_auth_pct_markup.val);
        if (+o_ccAuthSvcConfig.custrecord_an_auth_pct_markup.val > 0)
        {
            f_authTotal = (+f_authTotal + (+f_authTotal * (+o_ccAuthSvcConfig.custrecord_an_auth_pct_markup.val / 100))).toFixed(2);
            log.audit('Account configured to increase auth by '+o_ccAuthSvcConfig.custrecord_an_auth_pct_markup.val+'%', 'From '+getBaseCurrencyTotal(txn)+ ' to ' + f_authTotal);
        }
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.amount = f_authTotal;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = 'authOnlyTransaction';
        //token goes here
        if (b_isToken){
            var o_profile = {};
            o_profile.customerProfileId = o_token.getValue('custrecord_an_token_customerid');
            o_profile.paymentProfile = {};
            o_profile.paymentProfile.paymentProfileId = o_token.getValue('custrecord_an_token_token');

            exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.profile = o_profile;
        }
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.solution = o_ccAuthSvcConfig.solutionId;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest = exports.generateANetTransactionRequestJSON(txn, b_isToken, exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest);
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.retail = {
            'marketType' : o_ccAuthSvcConfig.custrecord_an_marketype.val ? o_ccAuthSvcConfig.custrecord_an_marketype.val : 2,//default to 2 if blank
            'deviceType' : o_ccAuthSvcConfig.custrecord_an_devicetype.val ? o_ccAuthSvcConfig.custrecord_an_devicetype.val : 5 //defaults to 5
        };

        //todo - validate if this works correctly to show card present
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.processingOptions = {"isStoredCredentials":true}

        //log.debug('POST-ing for AUTH', exports.AuthNetRequest.authorize)
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
        rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
        var response = {};
        try {
            rec_response.setValue('custrecord_an_txn', txn.id);
            rec_response.setValue('custrecord_an_calledby', txn.type);
            rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
            rec_response.setValue('custrecord_an_call_type', exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType);
            rec_response.setValue('custrecord_an_amount', f_authTotal);
            response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetRequest.authorize)
            });
            exports.homeSysLog('authOnlyTransaction request', exports.AuthNetRequest.authorize);
            exports.homeSysLog('response.body : '+response.code, response.body);
            var realTxn = txn ;
            var parsed = parseANetResponse(rec_response, realTxn, response);
            rec_response = parsed.history;
            realTxn = parsed.txn;
            /*if (b_isToken && !parsed.status) {
                throw '<span style=color:red;font-weight:bold;font-size:24px>Communication with Authorize.net has failed - Unable to process the token / auth+capture / anything! </span>';
            }*/
        } catch (e) {
            log.emergency(e.name, e.message);
            log.emergency(e.name, e.stack);
            log.emergency(response.code, response.body);
            txn.setValue({fieldId:'custbody_authnet_settle_status', value:'ERR'});
            realTxn = txn;
            rec_response.setValue({fieldId:'custrecord_an_response_status', value: 'Error'});
            rec_response.setValue({fieldId: 'custrecord_an_response_code', value : '0'});
            rec_response.setValue({fieldId:'custrecord_an_error_code', value: e.name});
            rec_response.setValue({fieldId:'custrecord_an_response_message', value: 'Authorize.Net <> NetSuite: '+e.message});
            rec_response.setValue({fieldId:'custrecord_an_response_ig_advice', value: 'A NetSuite based exception was caught but the transaction did not process correctly.'});
            if (e.name === 'DENIAL'){
                //this is hack for tokens
                rec_response.save({ignoreMandatoryFields : true});
                throw e;
            }
        } finally{
            rec_response.save({ignoreMandatoryFields : true});
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
        rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
        rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetRequest.authorize)
            });
            //log.debug('response.body', response.body);
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
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            if (parsed){
                parsed.status = false;
            }
            rec_response.setValue({fieldId:'custrecord_an_response_status', value: 'Error'});
            rec_response.setValue({fieldId: 'custrecord_an_response_code', value : 0});
            rec_response.setValue({fieldId:'custrecord_an_error_code', value: e.name});
            rec_response.setValue({fieldId:'custrecord_an_response_message', value: 'Authorize.Net <> NetSuite: '+e.message});
            rec_response.setValue({fieldId:'custrecord_an_response_ig_advice', value: 'A NetSuite based exception was caught but the transaction did not process correctly.'});
        } finally {
            parsed.historyId = parsed.history.save({ignoreMandatoryFields : true});
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
        rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
        rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
        rec_response.setValue({fieldId: 'custrecord_an_txn', value: histRec.getValue('custrecord_an_txn')});
        rec_response.setValue({fieldId: 'custrecord_an_calledby',  value: histRec.getValue('custrecord_an_calledby')});
        rec_response.setValue({fieldId: 'custrecord_an_customer',  value: histRec.getValue('custrecord_an_customer')});
        rec_response.setValue({fieldId: 'custrecord_an_call_type',  value: histRec.getValue('custrecord_an_call_type')});
        rec_response.setValue({fieldId: 'custrecord_an_amount',  value: histRec.getValue('custrecord_an_amount')});
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetFraudUpdate)
            });
            //('response.body', response.body);
            var realTxn = txn ;
            //realTxn.setValue({fieldId:'custbody_authnet_reqrefid', value: txn.id.toString()});

            var parsed = parseANetResponse(rec_response, realTxn, response);
            parsed.fromId = txn.id;
            parsed.fromType = histRec.getValue('custrecord_an_calledby');
            //log.debug('parsed.status', parsed.status);
            //log.debug('parsed.history', parsed.history);
            //log.debug('parsed.txn', parsed.txn);

        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            if (parsed){
                parsed.status = false;
            }
            rec_response.setValue({fieldId:'custrecord_an_response_status', value: 'Error'});
            rec_response.setValue({fieldId: 'custrecord_an_response_code', value : 0});
            rec_response.setValue({fieldId:'custrecord_an_error_code', value: e.name});
            rec_response.setValue({fieldId:'custrecord_an_response_message', value: 'Authorize.Net <> NetSuite: '+e.message});
            rec_response.setValue({fieldId:'custrecord_an_response_ig_advice', value: 'A NetSuite based exception was caught but the transaction did not process correctly.'});
            rec_response.save({ignoreMandatoryFields:true});
        } finally {
            parsed.historyId = parsed.history.save({ignoreMandatoryFields : true});
            delete parsed.history;
        }
        return parsed;
    };

    var callCapture = {};
    callCapture[1] = function(txn, o_ccAuthSvcConfig){
        exports.homeSysLog('Starting callCapture with this config', o_ccAuthSvcConfig);
        //var soId = txn.getValue('createdfrom') ? txn.getValue('createdfrom') : txn.id;
        var f_authTotal = getBaseCurrencyTotal(txn);
        //todo - if this f_authTotal is 0, do not send.
        var soId = txn.id;
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl;
        exports.AuthNetRequest.authorize.createTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        //note the order of how this object is built is critical
        exports.AuthNetRequest.authorize.createTransactionRequest.refId = soId;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = 'priorAuthCaptureTransaction';
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.amount = f_authTotal;
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.refTransId = txn.getValue('custbody_authnet_refid');
        //now ensure all the prior auth data is GONE!
        txn = cleanAuthNet(txn, true);
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
        rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
        rec_response.setValue('custrecord_an_txn', txn.id);
        rec_response.setValue('custrecord_an_calledby', txn.type);
        rec_response.setValue('custrecord_an_refid', txn.getValue({fieldId:'custbody_authnet_refid'}));
        rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
        rec_response.setValue('custrecord_an_call_type', exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType);
        rec_response.setValue('custrecord_an_amount', f_authTotal);
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetRequest.authorize)
            });
            exports.homeSysLog('priorAuthCaptureTransaction request', exports.AuthNetRequest.authorize);
            exports.homeSysLog('response.body', response.body);

            //var realTxn = txn ;
            //realTxn.setValue('custbody_authnet_reqrefid', txn.id.toString());

            var parsed = parseANetResponse(rec_response, txn, response);
            parsed.fromId = soId;
            //log.debug('parsed.status', parsed.status);
            //log.debug('parsed.history', parsed.history);
            //log.debug('parsed.txn', parsed.txn);

        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            if (parsed){
                parsed.status = false;
            }
            rec_response.setValue({fieldId:'custrecord_an_response_status', value: 'Error'});
            rec_response.setValue({fieldId: 'custrecord_an_response_code', value : 0});
            rec_response.setValue({fieldId:'custrecord_an_error_code', value: e.name});
            rec_response.setValue({fieldId:'custrecord_an_response_message', value: 'Authorize.Net <> NetSuite: '+e.message});
            rec_response.setValue({fieldId:'custrecord_an_response_ig_advice', value: 'A NetSuite based exception was caught but the transaction did not process correctly.'});
            rec_response.save({ignoreMandatoryFields:true});
        } finally {
            parsed.historyId = parsed.history.save({ignoreMandatoryFields : true});
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
        }
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.solution = o_ccAuthSvcConfig.solutionId;
        //added 9/3/2019 to provide more details on this transaction
        //now build the whole order like you do for an auth -
        exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest = exports.generateANetTransactionRequestJSON(txn, b_isToken, exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest);
        //now ensure all the prior auth data is GONE!
        txn = cleanAuthNet(txn, true);
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
        rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
        rec_response.setValue('custrecord_an_txn', txn.id);
        rec_response.setValue('custrecord_an_calledby', txn.type);
        rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
        rec_response.setValue('custrecord_an_call_type', exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType);
        rec_response.setValue('custrecord_an_amount', f_authTotal);
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetRequest.authorize)
            });
            exports.homeSysLog('callAuthCapture request', exports.AuthNetRequest.authorize);
            exports.homeSysLog('response.body', response.body);

            var realTxn = txn ;
            //realTxn.setValue('custbody_authnet_reqrefid', txn.id.toString());

            var parsed = parseANetResponse(rec_response, realTxn, response, o_ccAuthSvcConfig);
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
            log.error(e.name, e.stack);
            if (parsed){
                parsed.status = false;
            }
            rec_response.setValue({fieldId:'custrecord_an_response_status', value: 'Error'});
            rec_response.setValue({fieldId: 'custrecord_an_response_code', value : 0});
            rec_response.setValue({fieldId:'custrecord_an_error_code', value: e.name});
            rec_response.setValue({fieldId:'custrecord_an_response_message', value: 'Authorize.Net <> NetSuite: '+e.message});
            rec_response.setValue({fieldId:'custrecord_an_response_ig_advice', value: 'A NetSuite based exception was caught but the transaction did not process correctly.'});
            rec_response.save({ignoreMandatoryFields:true});
        } finally {
            parsed.historyId = parsed.history.save({ignoreMandatoryFields : true});
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
        var o_createdFrom = search.lookupFields({type : 'transaction', id:txn.getValue('createdfrom'), columns :['type', 'createdfrom', 'createdfrom.type', 'custbody_authnet_refid']});
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
        var o_paymentMethod = {}
        var s_tranId = txn.getValue({fieldId: 'custbody_authnet_refid'}) ? txn.getValue({fieldId: 'custbody_authnet_refid'}) : o_createdFrom.custbody_authnet_refid;
        var o_orgTxnResponse = doCheckStatus[1](o_ccAuthSvcConfig, s_tranId);
        exports.verboseLogging('callRefund().doCheckStatus() o_orgTxnResponse', o_orgTxnResponse);
        if (!o_orgTxnResponse.isValidAuth)
        {
            if(runtime.envType !== runtime.EnvType.PRODUCTION)
            {
                throw 'SANDBOX Authorize.Net code ('+o_orgTxnResponse.messages.resultCode+') '+ o_orgTxnResponse.messages.message[0].code + ' : '+ o_orgTxnResponse.messages.message[0].text + '  ***  Is this a PRODUCTION transaction?  ***';
            }
            else
            {
                throw 'Authorize.Net is reporting code ('+o_orgTxnResponse.messages.resultCode+') '+ o_orgTxnResponse.messages.message[0].code + ' : '+ o_orgTxnResponse.messages.message[0].text;
            }

        }
        else if (o_orgTxnResponse.fullResponse.payment.creditCard)
        {
            o_paymentMethod = {
                creditCard: {
                    cardNumber: o_orgTxnResponse.fullResponse.payment.creditCard.cardNumber,
                    expirationDate: o_orgTxnResponse.fullResponse.payment.creditCard.expirationDate,
                }
            }
        }
        //also do this for echeck!
        else if (o_orgTxnResponse.fullResponse.payment.bankAccount)
        {
            o_paymentMethod = {
                bankAccount: {
                    accountType: o_orgTxnResponse.fullResponse.payment.bankAccount.accountType,
                    routingNumber: o_orgTxnResponse.fullResponse.payment.bankAccount.routingNumber,
                    accountNumber: o_orgTxnResponse.fullResponse.payment.bankAccount.accountNumber,
                    nameOnAccount: o_orgTxnResponse.fullResponse.payment.bankAccount.nameOnAccount,
                    echeckType: o_orgTxnResponse.fullResponse.payment.bankAccount.echeckType,
                }
            }
        }
        else if (o_orgTxnResponse.fullResponse.payment.tokenInformation)
        {
            o_paymentMethod = {creditCard : {
                    cardNumber : o_orgTxnResponse.fullResponse.payment.tokenInformation.tokenNumber,
                    expirationDate : o_orgTxnResponse.fullResponse.payment.tokenInformation.expirationDate,
                }
            }
        }

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
                'name': txn.getSublistText({sublistId: 'item', fieldId: 'item', line: i}).substring(0, 29),
                'quantity': txn.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i}) ? txn.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i}).toString() : '1',
                'unitPrice' : '0'
            };
            //not all folks use a description
            if (txn.getSublistValue({sublistId: 'item', fieldId: 'description', line: i}))
            {
                //obj.description = txn.getSublistValue({sublistId: 'item', fieldId: 'description', line: i}).substring(0, 29);
            }
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
        rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
        rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
        rec_response.setValue('custrecord_an_txn', txn.id);
        rec_response.setValue('custrecord_an_calledby', txn.type);
        rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
        rec_response.setValue('custrecord_an_call_type', exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType);
        rec_response.setValue('custrecord_an_amount', f_authTotal);
        var parsed = {
            status : true,
            fromId : txn.getValue('createdfrom')
        };
        try {
            exports.homeSysLog('REFUND REQUEST', exports.AuthNetRequest.authorize);
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetRequest.authorize)
            });
            //log.debug('response.body', response.body)
            var realTxn = txn ;
            //realTxn.setValue('custbody_authnet_reqrefid', txn.id.toString());
            //indicates this transaction is DONE
            realTxn.setValue('custbody_authnet_done', true);
            parsed = parseANetResponse(rec_response, realTxn, response);
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
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            if (parsed){
                parsed.status = false;
            }
            rec_response.setValue({fieldId:'custrecord_an_response_status', value: 'Error'});
            rec_response.setValue({fieldId: 'custrecord_an_response_code', value : 0});
            rec_response.setValue({fieldId:'custrecord_an_error_code', value: e.name});
            rec_response.setValue({fieldId:'custrecord_an_response_message', value: 'Authorize.Net <> NetSuite: '+e.message});
            rec_response.setValue({fieldId:'custrecord_an_response_ig_advice', value: 'A NetSuite based exception was caught but the transaction did not process correctly.'});
            rec_response.save({ignoreMandatoryFields:true});
        } finally {
            if (parsed.history)
            {
                parsed.historyId = parsed.history.save({ignoreMandatoryFields : true});
                delete parsed.history;
            }
        }
        return parsed;
    };


        exports.performBulkRefunds = function(txn, a_toProcess){//orgtxn, o_ccAuthSvcConfig, a_toProcess
            var o_ccAuthSvcConfig = this.getConfigFromCache(txn);
            exports.verboseLogging('STARTING performBulkRefunds - here\'s the config', o_ccAuthSvcConfig);
            if (o_ccAuthSvcConfig.mode === 'subsidiary')
            {
                o_ccAuthSvcConfig = exports.getSubConfig(txn.getValue({fieldId:'subsidiary'}), o_ccAuthSvcConfig);
            }
            var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl, o_response = [];
            //log.debug('***********************', a_toProcess);
            _.forEach(a_toProcess, function(toRefund){
                //{"id":8791,"type":"DepAppl","created":"5/29/2018 11:31 am","anetTxnId":8524,"amount":0.35,"anet":{"refid":"40011619623","card":"Visa","timestamp":"3/19/2018 4:19 pm"}}
                exports.verboseLogging('bulkrefund (toRefund)', toRefund);
                //GET the original transaction details
                var o_orgTxnResponse = doCheckStatus[1](o_ccAuthSvcConfig, toRefund.anetRefId);
                exports.verboseLogging('bulkrefund (o_orgTxnResponse)', o_orgTxnResponse);
                exports.AuthNetRequest.authorize.createTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
                //note the order of how this object is built is critical
                exports.AuthNetRequest.authorize.createTransactionRequest.refId = toRefund.nsTxnId;
                //switch to a void here based on the toRefund.anet.status
                if (o_orgTxnResponse.transactionStatus === 'capturedPendingSettlement'){
                    //this is a VOID now!
                    exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = 'voidTransaction';
                }
                else
                {
                    exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType = 'refundTransaction';
                }
                var f_authTotal = getBaseCurrencyTotal(txn, toRefund.amount);
                //txn.setValue('custbody_authnet_amount', f_authTotal);
                exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.amount = f_authTotal;
                //log.debug('o_createdFromHistory', o_createdFromHistory)
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
                else if (o_orgTxnResponse.fullResponse.payment.tokenInformation)
                {
                    o_paymentMethod = {creditCard : {
                            cardNumber : o_orgTxnResponse.fullResponse.payment.tokenInformation.tokenNumber,
                            expirationDate : o_orgTxnResponse.fullResponse.payment.tokenInformation.expirationDate,
                        }
                    }
                }
                exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.payment = o_paymentMethod;
                exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.refTransId = toRefund.anetRefId;
                exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.order = {};
                exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.order.invoiceNumber = o_orgTxnResponse.fullResponse.order.invoiceNumber;
                exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.order.description = 'Customer Refund';
                //does not use enhanced field data
                log.error('REFUND CALL TO VALIDATE', exports.AuthNetRequest.authorize);
                var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
                rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
                rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
                rec_response.setValue('custrecord_an_txn', toRefund.id);
                var s_txnType = (txn.type === 'customerrefund') ? txn.type : (toRefund.type === 'DepAppl') ? 'depositapplication' : 'creditmemo';
                rec_response.setValue('custrecord_an_calledby', s_txnType);
                rec_response.setValue('custrecord_an_customer', _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer'));
                rec_response.setValue('custrecord_an_call_type', exports.AuthNetRequest.authorize.createTransactionRequest.transactionRequest.transactionType);
                rec_response.setValue('custrecord_an_amount', f_authTotal);
                try {
                    var response = https.post({
                        headers: {'Content-Type': 'application/json'},
                        url: authSvcUrl,
                        body: JSON.stringify(exports.AuthNetRequest.authorize)
                    });
                    exports.homeSysLog('performBulkRefunds response : '+response.code, response.body);

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
                    log.error(e.name, e.stack);
                    if (parsed){
                        parsed.status = false;
                    }
                    rec_response.setValue({fieldId:'custrecord_an_response_status', value: 'Error'});
                    rec_response.setValue({fieldId: 'custrecord_an_response_code', value : 0});
                    rec_response.setValue({fieldId:'custrecord_an_error_code', value: e.name});
                    rec_response.setValue({fieldId:'custrecord_an_response_message', value: 'Authorize.Net <> NetSuite: '+e.message});
                    rec_response.setValue({fieldId:'custrecord_an_response_ig_advice', value: 'A NetSuite based exception was caught but the transaction did not process correctly.'});
                    rec_response.save({ignoreMandatoryFields:true});
                } finally {
                    parsed.historyId = parsed.history.save({ignoreMandatoryFields : true});
                    delete parsed.history;
                    o_response.push(parsed);
                }
            });
            return o_response;
        };

    var callSettlement = {};
    //1 is the ID for Authorize.net calls
    callSettlement[1] = function(txn, o_ccAuthSvcConfig) {
        log.audit('STARTING - callSettlement[1]', txn.getValue({fieldId: 'tranid'}));
        var authSvcUrl = o_ccAuthSvcConfig.authSvcUrl;
        exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;

        /**
         * Inside NetSuite Integration TIP
         * If you want to call this from a custom map/reduce for say imported transactions not flowing all the way into
         * this code. - you can easily take whatever field has the tranid on the record you want to get settlement data on
         * and do the following in the map reduce - using this library
         *      txn = record.load({
         *         type: recToChange.rectype,
         *         id: recToChange.id
         *       });
         *       txn.setValue({fieldId: 'custbody_authnet_refid', value : txn.getValue({fieldId: 'custbody_WHATEVER YOUR FIELD ID IS'})});
         *       authNet.doSettlement(txn);
         *
         */

        //because we use different fields - this needs to happen
        if (txn.type === 'cashrefund'){
            exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.transId = txn.getValue({fieldId: 'custbody_authnet_refunded_tran'}) ? txn.getValue({fieldId: 'custbody_authnet_refunded_tran'}) : (txn.getValue({fieldId: 'custbody_magento_transid'}) ? txn.getValue({fieldId: 'custbody_magento_transid'}) : txn.getValue({fieldId: 'custbody_authnet_refid'}));
        } else {
            exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.transId = txn.getValue({fieldId: 'custbody_authnet_refid'});
        }

        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: authSvcUrl,
                body: JSON.stringify(exports.AuthNetGetTxnStatus)
            });

            var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
            rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
            rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
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
            rec_response.setValue({fieldId: 'custrecord_an_txn', value: txn.id});
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
                    var o_settlementRun = exports.getSettlmentRec();
                    if (!_.isEmpty(o_settlementRun)) {
                        rec_response.setValue({
                            fieldId: 'custrecord_an_settle_run',
                            value: o_settlementRun.id
                        });
                    }
                } else {
                    //deal with the error here
                    rec_response.setValue({fieldId: 'custrecord_an_refid', value: exports.AuthNetGetTxnStatus.getTransactionDetailsRequest.transId});
                    rec_response.setValue({fieldId: 'custrecord_an_response_status', value: o_body.messages.resultCode});
                    txn.setValue({
                        fieldId: 'custbody_authnet_settle_status',
                        value: o_body.messages.message[0].text
                    });
                }
            }
            txn.save({ignoreMandatoryFields : true});
        } catch (e) {
            log.emergency(e.name, e.message);
            log.emergency(e.name, e.stack);
        } finally {
            rec_response.save({ignoreMandatoryFields : true});
        }
        log.audit('COMPLETING - callSettlement[1]', txn.getValue({fieldId: 'tranid'}) + ' status: '+ txn.getValue({
            fieldId: 'custbody_authnet_settle_status'
        }));

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
        o_newProfileRequest.createCustomerProfileRequest.profile.merchantCustomerId = 'NSIid-'+o_profile.getValue({fieldId: 'custrecord_an_token_entity'});
        //can we pull the customer name into o_newProfileRequest.createCustomerProfileRequest.profile.description
        var s_description = o_profile.getValue({fieldId:'custrecord_an_token_name_on_card'}) ? o_profile.getValue({fieldId:'custrecord_an_token_name_on_card'}) : o_profile.getValue({fieldId:'custrecord_an_token_bank_nameonaccount'});
        if (s_description.length > 0)
        {
            o_newProfileRequest.createCustomerProfileRequest.profile.description = s_description + (+o_profile.getValue({fieldId: 'custrecord_an_token_paymenttype'}) === 1 ? ' (CC' : ' (ACH' )+ ' : ' + o_profile.getValue({fieldId: 'custrecord_an_token_uuid'}) + ')';
        }
        else
        {
            o_newProfileRequest.createCustomerProfileRequest.profile.description = (+o_profile.getValue({fieldId: 'custrecord_an_token_paymenttype'}) === 1 ? '(CC' : '(ACH' )+ ' : ' + o_profile.getValue({fieldId: 'custrecord_an_token_uuid'}) + ')';
        }
        if (o_profile.getValue({fieldId: 'custrecord_an_token_entity_email'})) {
            o_newProfileRequest.createCustomerProfileRequest.profile.email = o_profile.getValue({fieldId: 'custrecord_an_token_entity_email'});
        }
        o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles = {};
        o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.customerType = o_profile.getValue({fieldId: 'custpage_customertype'}) ? o_profile.getValue({fieldId: 'custpage_customertype'}) : o_profile.getValue({fieldId: 'custrecord_an_token_customer_type'});
        if(_.isEmpty(o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.customerType))
        {
            throw 'No valid Customer Type was provided (individual / business) - this is a mandatory field per Authorize.Net'
        }
        //o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo = {https://developer.authorize.net/api/reference/index.html#customer-profiles-create-customer-profile}
        var o_billingAddressObject = {};
        if (o_profile.getValue({fieldId: 'custrecord_an_token_billaddress_json'}))
        {
            o_billingAddressObject = JSON.parse(o_profile.getValue({fieldId: 'custrecord_an_token_billaddress_json'}));
            //log.debug('PRE MOD o_billingAddressObject', o_billingAddressObject);
        }
        //log.debug('PRE MOD o_newProfileRequest', o_newProfileRequest);
        //is this JSON and can we get the billing address from it?
        try
        {
            //now build the correct address information here

            if (o_profile.getValue({fieldId: 'custrecord_an_token_name_on_card'}))
            {
                o_billingAddressObject.firstname = o_profile.getValue({fieldId: 'custrecord_an_token_name_on_card'});
            }
            if (o_profile.getValue({fieldId: 'custrecord_an_token_lastname_on_card'}))
            {
                o_billingAddressObject.lastname = o_profile.getValue({fieldId: 'custrecord_an_token_lastname_on_card'});
            }
            if (o_profile.getValue({fieldId: 'custrecord_an_token_entity_addr_number'}))
            {
                o_billingAddressObject.address = o_profile.getValue({fieldId: 'custrecord_an_token_entity_addr_number'});
            }
            if (o_profile.getValue({fieldId: 'custrecord_an_token_entity_addr_city'}))
            {
                o_billingAddressObject.city = o_profile.getValue({fieldId: 'custrecord_an_token_entity_addr_city'});
            }
            if (o_profile.getValue({fieldId: 'custrecord_an_token_entity_addr_state'}))
            {
                o_billingAddressObject.state = o_profile.getValue({fieldId: 'custrecord_an_token_entity_addr_state'});
            }
            if (o_profile.getValue({fieldId: 'custrecord_an_token_entity_addr_zip'}))
            {
                o_billingAddressObject.zip = o_profile.getValue({fieldId: 'custrecord_an_token_entity_addr_zip'});
                if (o_profile.getValue({fieldId: 'custrecord_an_token_entity_addr_zipplus4'}))
                {
                    o_billingAddressObject.zip += '-' + o_profile.getValue({fieldId: 'custrecord_an_token_entity_addr_zipplus4'});
                }
            }
            if (o_profile.getValue({fieldId: 'custrecord_an_token_entity_phone'}))
            {
                o_billingAddressObject.phoneNumber = o_profile.getValue({fieldId: 'custrecord_an_token_entity_phone'});
            }
            var s_address = o_billingAddressObject.address
            if (o_billingAddressObject.billaddress2)
            {
                s_address += ', '+o_billingAddressObject.billaddress2;
            }
            log.debug('POST MOD o_billingAddressObject', o_billingAddressObject);
            o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo = {
                firstName : o_billingAddressObject.firstname,
                lastName : o_billingAddressObject.lastname,
                company : o_billingAddressObject.companyname,
                address : s_address,
                city : o_billingAddressObject.city,
                state : o_billingAddressObject.state,
                zip : o_billingAddressObject.zip,
                country : o_billingAddressObject.country,
            }
            if (o_billingAddressObject.phoneNumber)
            {
                o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo.phoneNumber = o_billingAddressObject.phoneNumber;
            }
            if (+o_profile.getValue({fieldId: 'custrecord_an_token_paymenttype'}) === 1)
            {
                if (!_.isUndefined(o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo.firstName))
                {
                    delete o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo.company;
                }
            }
            else
            //this is used for echeck only - and becasue the address record does not have first / last name, we need to cobble here
            {

                if (o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.customerType === 'individual')
                {
                    if (o_billingAddressObject.billaddressee)
                    {
                        var a_addressee = o_billingAddressObject.billaddressee.split(' ');
                        o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo.firstName = a_addressee[0];
                        if (a_addressee.length > 1) {
                            o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo.lastName = a_addressee[a_addressee.length - 1];
                        }
                        delete o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo.company;
                    }

                }
                else
                {
                    delete o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo.firstName;
                    delete o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo.lastName;
                    o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo.company = o_billingAddressObject.companyname;
                }
            }
            log.debug('FINAL o_billingAddressObject', o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo);
            //clean anything empty to prevent errors
            o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo = _.omitBy(o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.billTo, _.isEmpty);
            //the fact the JSON is really just XML is annoying right here - order matters...
            //log.debug('o_billingAddressObject', o_billingAddressObject)
        }
        catch (ex)
        {
            log.error('Unable to extract billing address', 'the CIM module was unable to extract billing information from the customer');
            log.error('Unable to extract billing address', ex.message);
            log.error('Unable to extract billing address', ex.stack);
        }
        var o_paymentProfile = {};
        if (+o_profile.getValue({fieldId: 'custrecord_an_token_paymenttype'}) === 1) {
            o_paymentProfile.creditCard = {};
            o_paymentProfile.creditCard.cardNumber = o_profile.getValue({fieldId: 'custrecord_an_token_cardnumber'});
            o_paymentProfile.creditCard.expirationDate = o_profile.getValue({fieldId: 'custrecord_an_token_expdate'});
            o_paymentProfile.creditCard.cardCode = o_profile.getValue({fieldId: 'custrecord_an_token_cardcode'});
            //allow setting of an actual test of a CC when tokenizing!
            //o_paymentProfile.validationMode = 'liveMode' or 'testMode'
            o_newProfileRequest.createCustomerProfileRequest.validationMode = o_ccAuthSvcConfig.custrecord_an_cim_live_mode.val ? 'liveMode' : 'testMode';
        }
        else
        {
            /*set these 2 only because - refunds!
            CCD	businessChecking	yes	yes	no	yes
            PPD	checking or savings	yes	yes	no*/
            o_paymentProfile.bankAccount = {};
            o_paymentProfile.bankAccount.accountType = o_profile.getValue({fieldId: 'custpage_banktype'});
            o_paymentProfile.bankAccount.routingNumber = o_profile.getValue({fieldId: 'custrecord_an_token_bank_routingnumber'});
            o_paymentProfile.bankAccount.accountNumber = o_profile.getValue({fieldId: 'custrecord_an_token_bank_accountnumber'});
            o_paymentProfile.bankAccount.nameOnAccount = o_profile.getValue({fieldId: 'custrecord_an_token_bank_nameonaccount'});
            o_paymentProfile.bankAccount.echeckType = o_profile.getValue({fieldId: 'custpage_achtype'});
            if (o_profile.getValue({fieldId: 'custrecord_an_token_bank_bankname'})){
                o_paymentProfile.bankAccount.bankName = o_profile.getValue({fieldId: 'custrecord_an_token_bank_bankname'});
            }
        }
        o_newProfileRequest.createCustomerProfileRequest.profile.paymentProfiles.payment = o_paymentProfile;
        exports.homeSysLog('getCIM(createNewProfile) REQUEST', o_newProfileRequest);
        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
        rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
        rec_response.setValue({fieldId: 'custrecord_an_cim_iscim', value: true});
        rec_response.setValue({fieldId: 'custrecord_an_calledby', value : 'newPaymentMethod'});
        rec_response.setValue({fieldId: 'custrecord_an_customer', value : o_profile.getValue({fieldId: 'custrecord_an_token_entity'})});
        rec_response.setValue({fieldId: 'custrecord_an_call_type', value : 'createCustomerProfileRequest'});
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(o_newProfileRequest)
            });
            exports.homeSysLog('getCIM(createNewProfile) response.body', response.body);
            var profileResponse = JSON.parse(response.body.replace('\uFEFF', ''));
            rec_response.setValue({fieldId: 'custrecord_an_response', value : JSON.stringify(profileResponse)});
            //log.debug('response.body.messages', profileResponse.messages)
            rec_response.setValue({fieldId: 'custrecord_an_response_status', value : profileResponse.messages.resultCode});
            rec_response.setValue({fieldId: 'custrecord_an_message_code', value : profileResponse.messages.message[0].code});
            rec_response.setValue({fieldId: 'custrecord_an_response_message', value : profileResponse.messages.message[0].text.substring(0, 300)});
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
                var accountIdx = _.findIndex(a_response, function(o) { return _.startsWith(o,'XXXX') });
                if (+o_profile.getValue({fieldId: 'custrecord_an_token_paymenttype'}) === 1){
                    o_createNewProfileResponse.creditCard = {
                        cardnum : a_response[accountIdx],
                        cardtype : a_response[accountIdx + 1],
                    }
                }
                else
                {
                    o_createNewProfileResponse.bankAccount = {
                        accountNum : a_response[accountIdx],
                        accountType : a_response[accountIdx + 1],
                    }
                }

                //todo - add more data from a good response here
            }
        } catch (e) {
            log.emergency(e.name, e.message);
            o_createNewProfileResponse.success = false;
            o_createNewProfileResponse.code = '000';
            o_createNewProfileResponse.message = e.name +' : ' + e.message;
            rec_response.setValue({fieldId:'custrecord_an_response_status', value: 'Error'});
            rec_response.setValue({fieldId: 'custrecord_an_response_code', value : 0});
            rec_response.setValue({fieldId:'custrecord_an_error_code', value: e.name});
            rec_response.setValue({fieldId:'custrecord_an_response_message', value: 'Authorize.Net <> NetSuite: '+e.message});
            rec_response.setValue({fieldId:'custrecord_an_response_ig_advice', value: 'A NetSuite based exception was caught but the transaction did not process correctly.'});
        } finally {
            o_createNewProfileResponse.histId = rec_response.save({ignoreMandatoryFields : true})
        }
        exports.homeSysLog('o_createNewProfileResponse', o_createNewProfileResponse);
        return o_createNewProfileResponse;
    };
    mngCustomerProfile.createProfileFromTxn = function(txn, o_ccAuthSvcConfig) {
        var o_createProfileResponse = {success:true, customerProfileId:null, txn : txn, histId:null};
        exports.AuthNetGetProfileFromTxn.createCustomerProfileFromTransactionRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetProfileFromTxn.createCustomerProfileFromTransactionRequest.transId = txn.getValue({fieldId: 'custbody_authnet_refid'});
        exports.AuthNetGetProfileFromTxn.createCustomerProfileFromTransactionRequest.customer = { merchantCustomerId : 'NSeId-'+(txn.getValue({fieldId: 'entity'}) ? txn.getValue({fieldId: 'entity'}) : txn.getValue({fieldId: 'customer'}) ) };

        var rec_response = record.create({type: 'customrecord_authnet_history', isDynamic: true});
        rec_response.setValue({fieldId: 'custrecord_an_parent_config', value: o_ccAuthSvcConfig.masterid});
        rec_response.setValue({fieldId: 'custrecord_an_sub_config', value: o_ccAuthSvcConfig.configid});
        rec_response.setValue({fieldId: 'custrecord_an_cim_iscim', value: true});
        rec_response.setValue({fieldId: 'custrecord_an_txn', value : txn.id});
        //maybe enable in the future, but solved in the refund call
        //rec_response.setValue({fieldId: 'custrecord_an_related_txnid', value : txn.getValue({fieldId: 'custbody_authnet_refid'})});
        rec_response.setValue({fieldId: 'custrecord_an_calledby', value : txn.type});
        rec_response.setValue({fieldId: 'custrecord_an_customer', value : _.isEmpty(txn.getValue('customer')) ? txn.getValue('entity'): txn.getValue('customer')});
        rec_response.setValue({fieldId: 'custrecord_an_call_type', value : 'createCustomerProfileFromTransactionRequest'});
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
            log.emergency(e.name, e.stack);
            o_createProfileResponse.success = false;
            rec_response.setValue({fieldId: 'custrecord_an_response_status', value: 'Error'});
            rec_response.setValue({fieldId: 'custrecord_an_response_code', value : 0});
            rec_response.setValue({fieldId: 'custrecord_an_error_code', value: e.name});
            rec_response.setValue({fieldId: 'custrecord_an_response_message', value: 'Authorize.Net <> NetSuite: '+e.message});
            rec_response.setValue({fieldId: 'custrecord_an_response_ig_advice', value: 'A NetSuite based exception was caught but the transaction did not process correctly.'});
        } finally {
            o_createProfileResponse.histId = rec_response.save({ignoreMandatoryFields : true})
        }
        if (!o_createProfileResponse.success)
        {
            log.error('createProfileFromTxn UNSUCCESSFUL - '+txn.getValue({fieldId:'tranid'}), o_createProfileResponse);
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
            exports.homeSysLog('getProfile(getCustomerProfileRequest) request', exports.AuthNetGetCustomerProfileRequest);
            exports.homeSysLog('getProfile(getCustomerProfileRequest) response.body', response.body);
            return  JSON.parse(response.body.replace('\uFEFF', ''));
        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            //o_createProfileResponse.success = false;
        } finally {
            //rec_response.save({ignoreMandatoryFields : true})
        }
    };

    mngCustomerProfile.getProfileByNSeId = function(nseid, o_ccAuthSvcConfig) {
        exports.homeSysLog('getProfileByNseId()', nseid);
        //var o_createProfileResponse = {success:true, customerProfileId:null, txn : txn};
        delete exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.customerProfileId;
        //again - it's really XML inside anet - so order matters!
        delete exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.includeIssuerInfo;
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.merchantCustomerId = nseid;
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.includeIssuerInfo = true;
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(exports.AuthNetGetCustomerProfileRequest)
            });
            exports.homeSysLog('getProfileByNSeId(getCustomerProfileRequest) request', exports.AuthNetGetCustomerProfileRequest);
            exports.homeSysLog('getProfileByNSeId(getCustomerProfileRequest) response.body', response.body);
            return  JSON.parse(response.body.replace('\uFEFF', ''));
        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            //o_createProfileResponse.success = false;
        } finally {
            //rec_response.save({ignoreMandatoryFields : true})
        }
    };

    mngCustomerProfile.importProfile = function(o_profile_JSON) {
        exports.homeSysLog('importProfile(o_profile_JSON)', o_profile_JSON);
        //get the config value from cache that we are looking for
        var o_ccAuthSvcConfig = exports.getConfigFromCache();
        log.debug('o_ccAuthSvcConfig', o_ccAuthSvcConfig);
        if (o_profile_JSON.fields.custrecord_an_token_gateway_sub)
        {
            o_ccAuthSvcConfig = _.find(o_ccAuthSvcConfig.subs, {'configid':o_profile_JSON.fields.custrecord_an_token_gateway_sub});
            log.debug('parsed sub config record', o_ccAuthSvcConfig);
        }
        else if (o_profile_JSON.fields.subsidiary)
        {
            o_ccAuthSvcConfig = exports.getSubConfig(o_profile_JSON.fields.subsidiary, o_ccAuthSvcConfig);
        }
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.customerProfileId = _.trim(o_profile_JSON.fields.custrecord_an_token_customerid) ;
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(exports.AuthNetGetCustomerProfileRequest)
            });
            exports.homeSysLog('importProfile(getCustomerProfileRequest) request', exports.AuthNetGetCustomerProfileRequest);
            exports.homeSysLog('importProfile(getCustomerProfileRequest) response.body', response.body);
            return  JSON.parse(response.body.replace('\uFEFF', ''));
        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            //o_createProfileResponse.success = false;
        } finally {
            //rec_response.save({ignoreMandatoryFields : true})
        }
    };

    mngCustomerProfile.importAndBuildProfilesOffProfileId = function(o_profile_JSON)
    {
        var o_profileResponse = {success : false};
        exports.verboseLogging('importProfile(o_profile_JSON)', o_profile_JSON);
        //get the config value from cache that we are looking for
        var o_ccAuthSvcConfig = exports.getConfigFromCache();
        exports.verboseLogging('STARTING importAndBuildProfilesOffProfileId.o_ccAuthSvcConfig', o_ccAuthSvcConfig)
        if (o_profile_JSON.fields.custrecord_an_token_gateway_sub)
        {
            o_ccAuthSvcConfig = _.find(o_ccAuthSvcConfig.subs, {'configid':o_profile_JSON.fields.custrecord_an_token_gateway_sub});
            exports.verboseLogging('parsed sub config record', o_ccAuthSvcConfig);
        }
        else if (o_profile_JSON.fields.subsidiary)
        {
            o_ccAuthSvcConfig = exports.getSubConfig(o_profile_JSON.fields.subsidiary, o_ccAuthSvcConfig);
        }
        exports.verboseLogging('importAndBuildProfilesOffProfileId.o_ccAuthSvcConfig', o_ccAuthSvcConfig)
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.merchantAuthentication = o_ccAuthSvcConfig.auth;
        exports.AuthNetGetCustomerProfileRequest.getCustomerProfileRequest.customerProfileId = _.trim(o_profile_JSON.fields.custrecord_an_token_customerid) ;
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(exports.AuthNetGetCustomerProfileRequest)
            });
            exports.verboseLogging('importAndBuildProfilesOffProfileId(getCustomerProfileRequest) request', exports.AuthNetGetCustomerProfileRequest);
            exports.verboseLogging('importAndBuildProfilesOffProfileId(getCustomerProfileRequest) response.body', response.body);
            var o_importProfileResponse = JSON.parse(response.body.replace('\uFEFF', ''));//.profile;
            exports.verboseLogging('importAndBuildProfilesOffProfileId.o_importProfileResponse', o_importProfileResponse);
            if (!_.isUndefined(o_importProfileResponse.profile)) {
                o_importProfileResponse = o_importProfileResponse.profile;
                _.forEach(o_importProfileResponse.paymentProfiles, function (profile) {
                    var o_currentTokenHistory = exports.findExistingProfile(o_profile_JSON.fields.entity, o_importProfileResponse.customerProfileId, profile.customerPaymentProfileId);
                    log.debug('o_currentTokenHistory', o_currentTokenHistory);
                    //{exits : b_thisOneExists, number : i_numMethods, hasDefault : b_hasDefault}
                    if (!o_currentTokenHistory.exits) {
                        log.debug('building a new profile CIM', profile);
                        var rec_cimProfile = record.create({type: 'customrecord_authnet_tokens', isDynamic: true});
                        //manage the setting of values if there's a subconfig issue here!
                        if (o_ccAuthSvcConfig.isSubConfig) {
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_gateway',
                                value: o_ccAuthSvcConfig.masterid
                            });
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_gateway_sub',
                                value: o_ccAuthSvcConfig.configid
                            });
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_subsidiary',
                                value: o_ccAuthSvcConfig.subid
                            });
                        } else {
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_gateway',
                                value: o_ccAuthSvcConfig.id
                            });
                        }
                        rec_cimProfile.setValue({
                            fieldId: 'custrecord_an_token_entity',
                            value: o_profile_JSON.fields.entity
                        });
                        rec_cimProfile.setValue({
                            fieldId: 'custrecord_an_token_customerid',
                            value: o_importProfileResponse.customerProfileId
                        });
                        rec_cimProfile.setValue({
                            fieldId: 'custrecord_an_token_token',
                            value: profile.customerPaymentProfileId
                        });
                        //validate email pattern
                        var s_email = '';
                        if (o_importProfileResponse.email)
                        {
                            o_importProfileResponse.email.replace(/\s/g, '');
                        }
                        //thank you https://www.w3resource.com/javascript/form/email-validation.php
                        if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(s_email))
                        {
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_entity_email',
                                value:s_email
                            });
                        }
                        if (!_.isUndefined(profile.payment.creditCard)) {
                            rec_cimProfile.setValue({fieldId: 'custrecord_an_token_paymenttype', value: 1});
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_type',
                                value: profile.payment.creditCard.cardType
                            });
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_last4',
                                value: profile.payment.creditCard.cardNumber
                            });
                            //todo - is this where we an option to save the exp date off config setting
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_expdate',
                                value: profile.payment.creditCard.expirationDate
                            });
                            rec_cimProfile.setValue({
                                fieldId: 'name',
                                value: profile.payment.creditCard.cardType + ' (' + profile.payment.creditCard.cardNumber + ')'
                            });
                        } else if (profile.payment.bankAccount) {
                            //bankAccount
                            rec_cimProfile.setValue({fieldId: 'custrecord_an_token_paymenttype', value: 2});
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_type',
                                value: profile.payment.bankAccount.accountType
                            });
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_last4',
                                value: profile.payment.bankAccount.accountNumber
                            });
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_bank_routingnumber',
                                value: profile.payment.bankAccount.routingNumber
                            });
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_bank_nameonaccount',
                                value: profile.payment.bankAccount.nameOnAccount
                            });
                            rec_cimProfile.setValue({fieldId: 'custrecord_an_token_expdate', value: ''});
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_bank_accounttype',
                                value: profile.payment.bankAccount.accountType
                            });
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_bank_echecktype',
                                value: profile.payment.bankAccount.echeckType
                            });
                            rec_cimProfile.setValue({
                                fieldId: 'name',
                                value: 'Bank Account (' + profile.payment.bankAccount.accountNumber + ')'
                            });
                        } else {
                            rec_cimProfile.setValue({fieldId: 'name', value: o_importProfileResponse.description});
                        }
                        if (!o_currentTokenHistory.hasDefault) {
                            //if none of the found tokens is default, make this one default
                            rec_cimProfile.setValue({
                                fieldId: 'custrecord_an_token_default',
                                value: true
                            });
                        }
                        o_profileResponse.id = rec_cimProfile.save({ignoreMandatoryFields: true});
                        exports.homeSysLog('NEW CIM ID', o_profileResponse.id);
                        //becasue UE's can't call UE's - this needs to self run here, otherwise the record will take care of itself!
                        if (runtime.executionContext === runtime.ContextType.USER_INTERFACE) {
                            log.debug('making the pblkchain', o_profileResponse.id)
                            record.submitFields({
                                type: rec_cimProfile.type,
                                id: o_profileResponse.id,
                                values: {
                                    custrecord_an_token_pblkchn: exports.mkpblkchain(rec_cimProfile, o_profileResponse.id)
                                },
                                options: {
                                    enableSourcing: false,
                                    ignoreMandatoryFields: true
                                }
                            });
                        }
                        o_profileResponse.success = true;
                    } else {
                        log.audit('This profile exists', 'It will not be re-imported');
                        o_profileResponse.success = true;
                    }
                });
            }
            else
            {
                log.audit('The profile could not be imported', 'This profile generated an error on import');
                if (o_importProfileResponse.messages){
                    o_profileResponse.success = false;
                    if(o_importProfileResponse.messages.message)
                    {
                        o_profileResponse.error = o_importProfileResponse.messages.message[0].code + ' : '+ o_importProfileResponse.messages.message[0].text;
                    }
                }
            }
        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            //o_createProfileResponse.success = false;
        }
        return o_profileResponse;
    }

    mngCustomerProfile.getAndBuildProfile = function(o_profile, o_ccAuthSvcConfig) {
        exports.homeSysLog('getAndBuildProfile(o_profile.customerProfileId & o_profile.customerPaymentProfileIdList)', o_profile.customerProfileId + ' :: ' + o_profile.customerPaymentProfileIdList);
        var o_profileResponse = {success : false};
        try{
            var profileResponse = mngCustomerProfile.getProfile(o_profile, o_ccAuthSvcConfig);
            //rec_response.setValue({fieldId: 'custrecord_an_response', value : JSON.stringify(profileResponse)});
            log.debug('response.body.messages', profileResponse);
            exports.homeSysLog('profileResponse.profile.paymentProfiles', profileResponse);
            var a_usedProfiles = [];
            //loop on the array of ID's used in customerPaymentProfileIdList":["1832901197"]
            _.forEach(o_profile.customerPaymentProfileIdList, function(profileId){
                //log .debug(profileId, 'Well?')
                var profile;
                if (profileResponse.profile && profileResponse.profile.paymentProfiles)
                {
                    profile = _.find(profileResponse.profile.paymentProfiles, {"customerPaymentProfileId": profileId});
                }
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
                    //to support other integrations the profile may b passed with a default setting and it will se it
                    if (o_profile.custrecord_an_token_default)
                    {
                        rec_cimProfile.setValue({
                            fieldId: 'custrecord_an_token_default',
                            value: true
                        });
                    }
                    o_profileResponse.id = rec_cimProfile.save({ignoreMandatoryFields : true});
                    o_profileResponse.success = true;

                    exports.homeSysLog('NEW CIM ID', o_profileResponse.id);
                    //becasue UE's can't call UE's - this needs to self run here, otehrwise the record will take care of itself!
                    if (runtime.executionContext === runtime.ContextType.USER_EVENT) {
                        record.submitFields({
                            type: rec_cimProfile.type,
                            id: o_profileResponse.id,
                            values: {
                                custrecord_an_token_pblkchn: exports.mkpblkchain(rec_cimProfile, o_profileResponse.id)
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });
                    }
                }
                else
                {
                    o_profileResponse.message = 'This profile already exists on the customer and will not be created a second time.'
                }
            });
        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
            //o_createProfileResponse.success = false;
        } finally {
            //rec_response.save({ignoreMandatoryFields : true})
        }
        return o_profileResponse;
    };

    //Settlement Tools
    var getSettledBatchListRequest = function(o_ccAuthSvcConfig, start, end){
        var o_summaryStatus = {};
        var o_request = o_getSettledBatchListRequest(o_ccAuthSvcConfig);
        o_request.getSettledBatchListRequest.firstSettlementDate = moment(start).format('YYYY-MM-DDT00:00:00Z');
        o_request.getSettledBatchListRequest.lastSettlementDate= moment(end).format('YYYY-MM-DDT00:00:00Z');
        log.debug('getSettledBatchListRequest request', o_request);
        try {
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(o_request)
            });

            log.debug('getSettledBatchListRequest response.body', response.body);
            var o_body = JSON.parse(response.body.replace('\uFEFF', ''));
            //log.debug('getSettledBatchListRequest o_body', o_body)
            if (o_body.batchList){
                o_summaryStatus.fullResponse = o_body;
            } else {
                if (o_body.messages){
                    if (o_body.messages.resultCode === 'Error'){
                        o_summaryStatus.error = true;
                        o_summaryStatus.message = o_body.messages.message[0].text;
                    }
                }
            }
        } catch (e) {
            log.error(e);
        } finally {

        }
        return o_summaryStatus;
    };

    var getTransactionListRequest = function(o_ccAuthSvcConfig, batchId){
        var o_summaryStatus = {};
        var o_request = o_getTransactionListRequest(o_ccAuthSvcConfig);
        o_request.getTransactionListRequest.batchId = batchId;
        o_request.getTransactionListRequest.paging.limit = 1000
        //log.debug('getTransactionListRequest request', o_request);
        try {
            var offSet = +o_request.getTransactionListRequest.paging.offset;
            var response = https.post({
                headers: {'Content-Type': 'application/json'},
                url: o_ccAuthSvcConfig.authSvcUrl,
                body: JSON.stringify(o_request)
            });
            //log.debug('getTransactionListRequest response.body', response.body);
            var o_body = JSON.parse(response.body.replace('\uFEFF', ''));
            var i_responseCount = o_body.totalNumInResultSet;
            while (i_responseCount === o_request.getTransactionListRequest.paging.offset)
            {
                offSet++;
                o_request.getTransactionListRequest.paging.offset = offSet.toString();
                //log.debug('NEW o_request', o_request)
                var newResponse = https.post({
                    headers: {'Content-Type': 'application/json'},
                    url: o_ccAuthSvcConfig.authSvcUrl,
                    body: JSON.stringify(o_request)
                });
                //log.debug('getTransactionListRequest newResponse.body OFFSET '+offSet, newResponse.body);
                var o_newBody = JSON.parse(response.body.replace('\uFEFF', ''));
                //log.debug(offSet, o_newBody.totalNumInResultSet)
                i_responseCount = +o_newBody.totalNumInResultSet;
                //log.debug('need to get more! - got '+i_responseCount, offSet);
                o_body.transactions = _.concat(o_body.transactions, o_newBody.transactions);
            }

            if (o_body.transactions){
                o_summaryStatus.fullResponse = o_body;
            } else {
            }
        } catch (e) {
            log.error(e.name, e.message);
            log.error(e.name, e.stack);
        } finally {

        }
        return o_summaryStatus;
    }

        return exports;
});


