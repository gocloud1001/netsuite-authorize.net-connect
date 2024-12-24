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
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 * @NModuleScope Public
 *
 * @NAmdConfig ../config.json
 */


define(['N/currentRecord', 'N/search', 'N/ui/message', 'N/ui/dialog', 'lodash', 'moment'],
    function(currentRecord, search, message, dialog, _, moment) {
        var exports = {
            sac : [],
            refundMethods : [],
            txninfo : {},
            aNetFields : ['custbody_authnet_cim_token']
        };

        function getApplyTxns (a_txnIds)
        {
            var a_filters = [
                ['internalid', 'anyof', a_txnIds],
                "AND",
                ['mainline', 'is', true]
            ];
            search.create({
                type: 'transaction',
                filters: a_filters,
                columns: [
                    {name: 'internalid'},
                    {name: 'tranid'},
                    {name: 'type'},
                    {name: 'custbody_authnet_refid'},
                    {name: 'custbody_authnet_datetime'},
                    {name: 'custbody_authnet_cim_token'},
                    {name: 'custbody_authnet_cim_token_type'},
                    {name: 'custbody_authnet_authcode', sort: search.Sort.DESC}
                ]
            }).run().each(function (result) {
                if (result.getValue('custbody_authnet_refid')) {
                    exports.sac.push(+result.getValue('internalid'));
                    exports.refundMethods.push(result.getValue({name: 'custbody_authnet_cim_token_type'}));
                    exports.txninfo[result.getValue('internalid')] =
                        {
                            tranid : result.getValue('tranid'),
                            refid : result.getValue('custbody_authnet_refid'),
                            type : result.getValue('type'),
                        }
                }
                return true;
            });
            exports.refundMethods = _.uniq(exports.refundMethods);
        }

        exports.test = function(context){
            //if(context.currentRecord.getValue({fieldId: 'custpage_c9_test'})) {

                var myMsg4 = message.create({
                    title: "Release Candidate",
                    message: "This is a release candidate version",
                    type: message.Type.ERROR
                });

                myMsg4.show({duration: 5000}); // will stay up until hide is called.
            //}
        }

        function getDefaultCard(currentRecord, o_config){
            try {
               console.log('getting DefaultCard - this might take a second or 2...');
               //console.log(o_config);
                if (!o_config){
                    alert('getDefaultCard missing a config object');
                }
                var custId = currentRecord.getValue({fieldId: 'entity'}) ? currentRecord.getValue({fieldId: 'entity'}) : currentRecord.getValue({fieldId: 'customer'});
                var a_filters = [
                    ['custrecord_an_token_entity', search.Operator.ANYOF, custId],
                    "AND",
                    //['custrecord_an_token_default', search.Operator.IS, "T"],
                    //"AND",
                    ['custrecord_an_token_pblkchn_tampered', search.Operator.IS, "F"],
                    "AND",
                    ['isinactive', search.Operator.IS, "F"],
                    "AND",
                    ['custrecord_an_token_token', 'isnotempty', ''],
                ];
                var a_columns = [
                    'name',
                    'custrecord_an_token_paymenttype',
                    'custrecord_an_token_default',
                    'custrecord_an_token_gateway',
                ];
                if (o_config.isSubConfig)
                {
                    a_filters.push("AND");
                    a_filters.push(['custrecord_an_token_gateway', search.Operator.ANYOF, o_config.masterid.toString()]);
                    a_filters.push("AND");
                    a_filters.push(['custrecord_an_token_gateway_sub', search.Operator.ANYOF, o_config.configid.toString()]);
                    a_filters.push("AND");
                    a_filters.push(['custrecord_an_token_subsidiary', search.Operator.ANYOF, o_config.subid.toString()]);
                    //a_filters.push(['custrecord_an_token_subsidiary', search.Operator.ANYOF, currentRecord.getValue({fieldId: 'subsidiary'})]);
                    a_columns.push('custrecord_an_token_gateway_sub');
                    a_columns.push('custrecord_an_token_subsidiary');
                    //set up the UI object for cars / subs
                    var o_uidata = JSON.parse(currentRecord.getValue({fieldId: 'custpage_sac_ui_data'}));
                    o_uidata.cards = [];
                }
                else
                {
                    a_filters.push("AND");
                    a_filters.push(['custrecord_an_token_gateway', search.Operator.ANYOF, o_config.id.toString()]);
                }
                //log.debug('token search filters', a_filters);
                search.create({
                    type: 'customrecord_authnet_tokens',
                    filters: a_filters,
                    columns: a_columns
                }).run().each(function (result) {
                    //log.debug('result', result);
                    if (result.getValue('custrecord_an_token_default'))
                    {
                        currentRecord.setValue({fieldId: 'custbody_authnet_cim_token', value: result.id, ignoreFieldChange:true});
                        var tokenTypeId = result.getValue('custrecord_an_token_paymenttype') ? result.getValue('custrecord_an_token_paymenttype') : 1;
                        currentRecord.setValue({
                            fieldId: 'custbody_authnet_cim_token_type',
                            value: tokenTypeId
                        });
                    }
                    if (o_config.isSubConfig)
                    {
                        var _card = {id : result.id, subsidiary : result.getValue('custrecord_an_token_subsidiary')};
                        o_uidata.cards.push(_card);
                    }
                    return true;
                });
                if (o_config.isSubConfig)
                {
                    console.log(o_uidata)
                    currentRecord.setValue({fieldId: 'custpage_sac_ui_data', value : JSON.stringify(o_uidata)});
                }
            }
            catch (e)
            {
                log.error(e.name, e.message);
                if(e.name === 'INSUFFICIENT_PERMISSION')
                {
                    alert('Unable to retrieve customer CIM profiles / card tokens : '+e.message);
                }
                else
                {
                    alert('Unable to retrieve customer CIM profiles / card tokens - this is a '+e.name+' error.');
                }
                //log.error(e.name, e.stack);
            }
        }

        function SAC_pageInit(context) {

            if(_.isNull(context.currentRecord.getField({fieldId: 'custpage_an_config'}))){
                dialog.alert({title:'Configuration is Missing', message:'The Authorize.Net User Event Script Is Not Deployed On This Form.  This transaction will not capture funds as expected without that script deployed.'});
            } else {
                window.sessionStorage.setItem("config", context.currentRecord.getValue({fieldId: 'custpage_an_config'}));
                console.log('Giggity giggity - we are a GO for SuiteAuthConnect in '+JSON.parse(window.sessionStorage.getItem("config")).mode+' mode! ' + JSON.stringify(context));
            }

            //context = {"currentRecord":{"id":"8045","type":"salesorder","isDynamic":true,"prototype":{}},"mode":"edit"}
            if (_.includes(['salesorder', 'cashsale','customerdeposit','customerpayment', 'cashrefund'],context.currentRecord.type)) {
                if (_.includes(['create', 'copy', 'edit'], context.mode)) {
                    _.forEach(exports.aNetFields, function(field){
                        try {

                            if (context.currentRecord.getValue({fieldId: 'custbody_authnet_use'}) && context.currentRecord.getValue({fieldId: 'custbody_authnet_cim_token'}) && field === 'custbody_authnet_cim_token'){
                                //skip hiding the token
                            }
                            else {
                                log.debug('rehiding token field')
                                window.nlapiGetField(field).setDisplayType('hidden');
                            }

                        } catch (e){
                            log.error('issue with client hide / show . ', 'Missing field : ' + field);
                        }
                    });
                }
                if (_.includes(['cashsale'], context.currentRecord.type)) {
                    //if this is a
                    if (context.currentRecord.getValue({fieldId: 'custbody_authnet_use'}) && !_.isEmpty(context.currentRecord.getValue({fieldId: 'custbody_authnet_refid'}))) {
                    }
                }
            } else if (_.includes(['customerrefund'], context.currentRecord.type)){
                try {
                    var a_fieldsToHide;
                    if(context.mode === 'edit')
                    {
                        a_fieldsToHide = [
                            'custbody_authnet_ccnumber',
                            'custbody_authnet_ccexp',
                            'custbody_authnet_ccv',
                            'custbody_authnet_override',
                            'custbody_authnet_cim_token',
                        ];
                    }
                    else
                    {
                        a_fieldsToHide = [
                            'custbody_authnet_ccnumber',
                            'custbody_authnet_ccexp',
                            'custbody_authnet_ccv',
                            'custbody_authnet_refid',
                            'custbody_authnet_authcode',
                            'custbody_authnet_override',
                            'custbody_authnet_cim_token',
                        ];
                    }
                    _.forEach(a_fieldsToHide,function(fld){
                        try
                        {
                            window.nlapiGetField(fld).setDisplayType('hidden');
                        }
                        catch (e)
                        {
                            //field does not exist
                        }
                    });
                    console.log('CUSTOMER REFUND : ' + context.currentRecord.getValue({fieldId: 'customer'}));
                    if (context.currentRecord.getValue({fieldId: 'customer'}))
                    {
                        var i_numDeposits = context.currentRecord.getLineCount({sublistId: 'deposit' });
                        var i_numCredits = context.currentRecord.getLineCount({sublistId: 'apply' });
                        //console.log(i_numDeposits + i_numCredits)
                        var a_txnIds = [];
                        for (var i = 0; i < i_numDeposits; i++){
                            a_txnIds.push(context.currentRecord.getSublistValue({sublistId: 'deposit' , fieldId: 'doc', line : i}));
                        }
                        for (var j = 0; j < i_numCredits; j++){
                            a_txnIds.push(context.currentRecord.getSublistValue({sublistId: 'apply' , fieldId: 'doc', line : j}));
                        }
                        //console.log(a_toBeTouchedLines)
                        if(_.isEmpty(exports.sac) && !_.isEmpty(a_txnIds)) {
                            getApplyTxns (a_txnIds);
                        }
                    }
                } catch (e){
                    console.log(e);
                }
            }
        }

        function SAC_postSourcing(context) {
            var o_config = JSON.parse(window.sessionStorage.getItem("config") );
            var fieldName = context.fieldId;
            //console.log('ps - ' +fieldName);
            if (fieldName === 'customer' || fieldName === 'entity' || fieldName === 'subsidiary')
            {
                if (o_config.mode === 'subsidiary') {
                    if (context.currentRecord.getValue({fieldId: 'subsidiary'})) {
                        log.debug('source sub change >>'+context.currentRecord.getValue({fieldId: 'subsidiary'}));
                        o_config = o_config.subs['subid' + context.currentRecord.getValue({fieldId: 'subsidiary'})];
                        if (!o_config)
                        {
                            //add a blank config because this sub is not supported.
                            o_config = {}
                            //disable these fields :
                            context.currentRecord.setValue({
                                fieldId: 'custbody_authnet_use',
                                value: false,
                                ignoreFieldChange: true
                            });
                            context.currentRecord.setValue({
                                fieldId: 'custbody_authnet_override',
                                value: false,
                                ignoreFieldChange: true
                            });
                            window.nlapiGetField('custbody_authnet_use').setDisplayType('disabled');
                            window.nlapiGetField('custbody_authnet_override').setDisplayType('disabled');
                        }
                        else
                        {
                            window.nlapiGetField('custbody_authnet_use').setDisplayType('normal');
                            window.nlapiGetField('custbody_authnet_override').setDisplayType('normal');
                            //load the cards fos this sub
                            getDefaultCard(context.currentRecord, o_config);
                        }
                        log.debug('postSourcing mode : subsidiary of '+ fieldName, o_config);
                    }
                    else
                    {
                        log.debug('postSourcing mode : '+o_config.mode+' of '+ fieldName, o_config);
                    }
                }
                //console.log('PS CUSTOMER REFUND : ' + context.currentRecord.getValue({fieldId: 'customer'}));
            }

            //console.log('postSourcing ' + fieldName)
            //be smart about this special record type
            if (_.includes(['customerrefund'], context.currentRecord.type)) {
                //if this is the customer getting set / changed
                if (fieldName === 'customer') {
                    //after things source - get all the transactions from the subtabs and search for authnet refundable
                    var i_numDeposits = context.currentRecord.getLineCount({sublistId: 'deposit' });
                    var i_numCredits = context.currentRecord.getLineCount({sublistId: 'apply' });
                    //console.log(i_numDeposits + i_numCredits)
                    var a_txnIds = [];
                    for (var i = 0; i < i_numDeposits; i++){
                        a_txnIds.push(context.currentRecord.getSublistValue({sublistId: 'deposit' , fieldId: 'doc', line : i}));
                    }
                    for (var j = 0; j < i_numCredits; j++){
                        a_txnIds.push(context.currentRecord.getSublistValue({sublistId: 'apply' , fieldId: 'doc', line : j}));
                    }
                    if(_.isEmpty(exports.sac) && !_.isEmpty(a_txnIds)) {
                        //same as pageInit
                        getApplyTxns (a_txnIds);
                    }
                }

            }
            if (fieldName === 'custbody_authnet_cim_token' && context.currentRecord.getValue({fieldId: 'custbody_authnet_cim_token'})){
                try {
                    if (o_config) {

                        //lookup the token type and set it
                        search.lookupFields.promise({
                            type: 'customrecord_authnet_tokens',
                            id: context.currentRecord.getValue({fieldId: 'custbody_authnet_cim_token'}),
                            columns : 'custrecord_an_token_paymenttype'
                        })
                        .then(function (result) {
                            var i_tokenTypeId = 1;
                            if (!_.isUndefined(result.custrecord_an_token_paymenttype[0]))
                            {
                                i_tokenTypeId = result.custrecord_an_token_paymenttype[0].value;
                            }
                            context.currentRecord.setValue({fieldId: 'custbody_authnet_cim_token_type', value : i_tokenTypeId})
                            if (+context.currentRecord.getValue({fieldId: 'custbody_authnet_cim_token_type'}) !== 2) {
                                context.currentRecord.setValue({
                                    fieldId: 'paymentmethod',
                                    value: o_config.custrecord_an_paymentmethod.val,
                                    ignoreFieldChange: true
                                });
                                if (o_config.hasPaymentInstruments) {
                                    context.currentRecord.setValue({
                                        fieldId: (o_config.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'),
                                        value: o_config.custrecord_an_paymentmethod.profileId,
                                        ignoreFieldChange: true
                                    });
                                }
                            } else {
                                context.currentRecord.setValue({
                                    fieldId: 'paymentmethod',
                                    value: o_config.custrecord_an_paymentmethod_echeck.val,
                                    ignoreFieldChange: true
                                });
                                if (o_config.hasPaymentInstruments) {
                                    context.currentRecord.setValue({
                                        fieldId: (o_config.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'),
                                        value: o_config.custrecord_an_paymentmethod_echeck.profileId,
                                        ignoreFieldChange: true
                                    });
                                }
                            }
                        })
                        .catch(function onRejected(reason) {
                            log.error('Client Token Type Failure', 'Token Type Lookup Failure');
                            console.log('Token Type Lookup Failed');
                        });
                    }
                    else
                    {
                        log.audit('No CONFIG', 'No valid config object!');
                    }
                } catch (e) {
                    log.audit('Account does not have native cc-processing enabled');
                }
            }
        }

        function SAC_fieldChanged(context) {
            var currentRecord = context.currentRecord;
            var fieldName = context.fieldId;
            //console.log('FC:' + context.sublistId + ' : '+fieldName);



            //this section is a bit of a mess and should be refactored to be cleaner...
            if (_.includes([
                'custbody_authnet_use',
                'custbody_authnet_override',
                'terms',
                'orderstatus',
                'apply',
                'paymentmethod',
                'paymentoption',
                'payment',
                'subsidiary',
                'custbody_authnet_cim_token'
            ], fieldName))
            {
                //console.log(currentRecord.type + ' : '+fieldName);
                var o_config = JSON.parse(window.sessionStorage.getItem("config"));
                if (o_config.mode === 'subsidiary') {
                    if (fieldName === 'subsidiary')
                    {
                        if (context.currentRecord.getValue({fieldId: 'custbody_authnet_use'}))
                        {
                            context.currentRecord.setValue({
                                fieldId: 'custbody_authnet_cim_token',
                                value: ''
                            });
                        }
                    }
                    if (context.currentRecord.getValue({fieldId: 'subsidiary'})) {
                        o_config = o_config.subs['subid' + context.currentRecord.getValue({fieldId: 'subsidiary'})];

                        if (_.isUndefined(o_config))
                        {
                            //when the sub is not setup for auth net
                            //disable these fields :
                            context.currentRecord.setValue({
                                fieldId: 'custbody_authnet_use',
                                value: false,
                                ignoreFieldChange: true
                            });
                            context.currentRecord.setValue({
                                fieldId: 'custbody_authnet_override',
                                value: false,
                                ignoreFieldChange: true
                            });
                            window.nlapiGetField('custbody_authnet_use').setDisplayType('disabled');
                            window.nlapiGetField('custbody_authnet_override').setDisplayType('disabled');
                            log.audit('This Subsidiary is not supported', 'The selected Subsdiary does not use authorzie.net');
                            return;
                        }
                        else
                        {
                            //sub is set up for authorize!
                            window.nlapiGetField('custbody_authnet_use').setDisplayType('normal');
                            window.nlapiGetField('custbody_authnet_override').setDisplayType('normal');
                        }
                    }
                    else
                    {
                        window.nlapiGetField('custbody_authnet_use').setDisplayType('disabled');
                        window.nlapiGetField('custbody_authnet_override').setDisplayType('disabled');
                        return;
                    }
                }
                //console.log('o_config')
                //console.log(o_config)
                if (fieldName === 'custbody_authnet_cim_token' && context.currentRecord.getValue({fieldId: 'custbody_authnet_cim_token'}))
                {
                    search.lookupFields.promise({
                        type: 'customrecord_authnet_tokens',
                        id: context.currentRecord.getValue({fieldId: 'custbody_authnet_cim_token'}),
                        columns : 'custrecord_an_token_paymenttype'
                    }).then(function (result) {
                        //log.debug('result', result)
                        var i_tokenTypeId = 1;
                        if (!_.isUndefined(result.custrecord_an_token_paymenttype[0]))
                        {
                            i_tokenTypeId = result.custrecord_an_token_paymenttype[0].value;
                        }
                        context.currentRecord.setValue({fieldId: 'custbody_authnet_cim_token_type', value : i_tokenTypeId})
                        if (+context.currentRecord.getValue({fieldId: 'custbody_authnet_cim_token_type'}) !== 2) {
                            context.currentRecord.setValue({
                                fieldId: 'paymentmethod',
                                value: o_config.custrecord_an_paymentmethod.val,
                                ignoreFieldChange: true
                            });
                            if (o_config.hasPaymentInstruments) {
                                context.currentRecord.setValue({
                                    fieldId: (o_config.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'),
                                    value: o_config.custrecord_an_paymentmethod.profileId,
                                    ignoreFieldChange: true
                                });
                            }
                        } else {
                            context.currentRecord.setValue({
                                fieldId: 'paymentmethod',
                                value: o_config.custrecord_an_paymentmethod_echeck.val,
                                ignoreFieldChange: true
                            });
                            if (o_config.hasPaymentInstruments) {
                                context.currentRecord.setValue({
                                    fieldId: (o_config.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'),
                                    value: o_config.custrecord_an_paymentmethod_echeck.profileId,
                                    ignoreFieldChange: true
                                });
                            }
                        }
                    }).catch(function onRejected(reason) {
                        log.error('Client Token Type Failure', reason);
                        console.log('Token Type Lookup Failed');
                    });
                }

                if (o_config.custrecord_an_paymentmethod)
                {
                    console.log('WHATS THE FIELD HERE : '+fieldName)
                    if (fieldName === (o_config.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'))
                    {
                        if (_.includes([o_config.custrecord_an_paymentmethod_echeck.val, o_config.custrecord_an_paymentmethod.val], context.currentRecord.getValue({fieldId: fieldName})) )
                        {
                            console.log(fieldName + ' was set to '+ context.currentRecord.getValue({fieldId: fieldName}))
                            if (!context.currentRecord.getValue({
                                fieldId: 'custbody_authnet_use',
                            })) {
                                context.currentRecord.setValue({
                                    fieldId: 'custbody_authnet_use',
                                    value: true
                                });
                            }
                        }
                        else
                        {
                            console.log(fieldName + ' was UNset to '+ context.currentRecord.getValue({fieldId: fieldName}))
                            console.log(fieldName + ' was UNset to '+ context.currentRecord.getValue({fieldId: 'paymentmethod'}))
                            context.currentRecord.setValue({
                                fieldId: 'custbody_authnet_use',
                                value: false,
                                ignoreFieldChange: true
                            });
                        }
                    }
                }
                //console.log('FOUND CONFIG : ' + JSON.stringify(o_config))
                var nativeFields = ['creditcard', 'ccnumber', 'ccexpiredate', 'creditcardprocessor', 'pnrefnum', 'authcode', 'terms'];
                //cc field changes - set this field to auth net
                if (_.includes(['salesorder', 'cashsale', 'customerdeposit', 'customerpayment', 'cashrefund'], currentRecord.type)) {
                    console.log(currentRecord.type + ' : '+fieldName)
                    //explicitly disallow terms and auth.net on the same SO
                    if (_.includes(['salesorder'], currentRecord.type))
                    {
                        switch (fieldName) {
                            case 'custbody_authnet_use':
                                var s_currentStatus = currentRecord.getValue({fieldId: 'orderstatus'});
                                console.log(s_currentStatus + ' :: ' + o_config.custrecord_an_generate_token_pend_approv.val)
                                if (_.includes(['B', 'D', 'E', 'F'], s_currentStatus) || (s_currentStatus === 'A' && o_config.custrecord_an_generate_token_pend_approv.val)) {
                                    _.forEach(exports.aNetFields, function (field) {
                                        try {
                                            currentRecord.setValue({fieldId: field, value: ''});
                                            window.nlapiGetField(field).setDisplayType('normal');
                                            console.log('show ' + field)
                                        } catch (e) {
                                            log.error('issue with client hide / show . ', 'Missing field : ' + field);
                                        }
                                    });
                                } else {
                                    currentRecord.setValue({
                                        fieldId: 'custbody_authnet_use',
                                        value: false,
                                        ignoreFieldChange: true
                                    });
                                    var s_status = currentRecord.getText({fieldId: 'orderstatus'})
                                    console.log('Nope : ' + currentRecord.getValue({fieldId: 'orderstatus'}) + ' ' + s_status);
                                    alert('You can not charge a customers credit card for a ' + s_status + ' transaction.  Either change the transaction to an approved state, change the Authorize.Net configuration or attempt to charge the card later.');
                                }
                                break;

                            case 'terms':
                                _.forEach(exports.aNetFields, function (field) {
                                    try {
                                        currentRecord.setValue({fieldId: field, value: '', ignoreFieldChange:true});
                                        window.nlapiGetField(field).setDisplayType('hidden');
                                        //console.log('hide ' + field)
                                    } catch (e) {
                                        log.error('issue with client hide / show . ', 'Missing field : ' + field);
                                    }
                                });
                                currentRecord.setValue({
                                    fieldId: 'custbody_authnet_use',
                                    value: false,
                                    ignoreFieldChange: true
                                });
                                currentRecord.setValue({
                                    fieldId: 'custbody_authnet_cim_token',
                                    value: '',
                                    ignoreFieldChange: true
                                });
                                break;
                            case 'orderstatus':
                                var s_currentStatus = currentRecord.getValue({fieldId: 'orderstatus'});
                                if (s_currentStatus !== 'B') {
                                    currentRecord.setValue({
                                        fieldId: 'custbody_authnet_use',
                                        value: false,
                                        ignoreFieldChange: false
                                    });
                                }
                                break;
                        }
                    }
                    else if (_.includes(['customerpayment'], currentRecord.type))
                    {
                        if (fieldName === 'payment')
                        {
                            if (+currentRecord.getValue({fieldId: 'custbody_authnet_settle_amount'}) !== 0)
                            {
                                if (+currentRecord.getValue({fieldId: 'custbody_authnet_settle_amount'}) !== +currentRecord.getValue({fieldId: 'payment'}))
                                {
                                    dialog.alert({title:'Payment Already Settled', message : 'This payment has already settled with Authorize.Net for $'+currentRecord.getValue({fieldId: 'custbody_authnet_settle_amount'})+'. You can not change the amount on this transaction.' });
                                    currentRecord.setValue({fieldId :'payment', value: currentRecord.getValue({fieldId: 'custbody_authnet_settle_amount'}), ignoreFieldChange: true});
                                }
                            }
                            else if (currentRecord.getValue({fieldId: 'custbody_authnet_datetime'}))
                            {
                                dialog.alert({title:'Payment Pending Settlement', message: 'This payment was submitted to Authorize.Net at '+currentRecord.getValue({fieldId: 'custbody_authnet_datetime'})+'. You can not change the amount on this transaction.' });
                            }
                        }
                        if (fieldName === 'custbody_authnet_use')
                        {
                            var i_numCredits = context.currentRecord.getLineCount({sublistId: 'apply' });
                            console.log(i_numCredits);
                            for (var j = 0; j < i_numCredits; j++){
                                console.log(j + ' : ' + context.currentRecord.getSublistValue({sublistId: 'apply' , fieldId: 'apply', line : j}));
                            }
                        }
                    }
                    if (fieldName === 'custbody_authnet_use') {
                        if (currentRecord.getValue({fieldId: 'custbody_authnet_use'})) {

                            getDefaultCard(context.currentRecord, o_config);
                            console.log('Selecting to USE Authorize.Net as a payment method');

                            try {
                                if (+currentRecord.getValue({fieldId: 'custbody_authnet_cim_token_type'}) !== 2) {
                                    console.log('running this here for setting stuff');
                                    //this field is always required
                                    currentRecord.setValue({fieldId :'paymentmethod', value: o_config.custrecord_an_paymentmethod.val,ignoreFieldChange: true});
                                    //this one is sometimes required
                                    if (o_config.hasPaymentInstruments) {
                                        /*currentRecord.setValue({
                                            fieldId: 'paymentoperation',
                                            value: 'SALE',
                                            ignoreFieldChange: true
                                        });
                                        currentRecord.setValue({
                                            fieldId: 'handlingmode',
                                            value: 'SAVE_ONLY',
                                            ignoreFieldChange: true
                                        });*/
                                        currentRecord.setValue({
                                            fieldId: 'paymentoption',
                                            text: o_config.custrecord_an_paymentmethod.profileId,
                                            ignoreFieldChange: true
                                        });
                                    }
                                } else {
                                    //this field is always required
                                    currentRecord.setValue({fieldId :'paymentmethod', value : o_config.custrecord_an_paymentmethod_echeck.val,ignoreFieldChange: true});
                                    //this one is sometimes required
                                    if (o_config.hasPaymentInstruments) {
                                        /*currentRecord.setValue({
                                            fieldId: 'paymentoperation',
                                            value: 'SALE',
                                            ignoreFieldChange: true
                                        });
                                        currentRecord.setValue({
                                            fieldId: 'handlingmode',
                                            value: 'SAVE_ONLY',
                                            ignoreFieldChange: true
                                        });*/
                                        currentRecord.setValue({
                                            fieldId: 'paymentoption',
                                            text: o_config.custrecord_an_paymentmethod_echeck.profileId,
                                            ignoreFieldChange: true
                                        });
                                    }
                                }
                            } catch (e) {
                                log.audit('Account does not have native cc-pocessing enabled');
                            }
                            _.forEach(exports.aNetFields, function (field) {
                                try {
                                    window.nlapiGetField(field).setDisplayType('normal');
                                    //console.log('show 2' + field)
                                } catch (e) {
                                    log.error('issue with client hide / show . ', 'Missing field : ' + field);
                                }
                            });
                            _.forEach(nativeFields, function (field) {
                                try {
                                    window.nlapiGetField(field).setDisplayType('hidden');
                                    currentRecord.setValue({fieldId: field, value: '', ignoreFieldChange: true});
                                } catch (e) {
                                    log.error('issue with client hide / show native ', 'Missing field : ' + field);
                                }
                            });

                            try {
                                currentRecord.setValue({fieldId :'creditcard', value :'', ignoreFieldChange: true});
                                currentRecord.setValue({fieldId: 'getauth', value: false, ignoreFieldChange: true});
                            } catch (e) {
                                log.debug('Native billing not enabled')
                            }
                            //window.nlapiDisableField('bullshit')
                        } else {
                            console.log('Selecting to NOT use Authorize.Net as a payment method');
                            //this field is always required
                            currentRecord.setValue({fieldId :'paymentmethod', value : '',ignoreFieldChange: true});
                            //this one is sometimes required
                            if (o_config.hasPaymentInstruments) {
                                currentRecord.setValue({
                                    fieldId: (o_config.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'),
                                    value: '',
                                    ignoreFieldChange: true
                                });
                            }
                            _.forEach(exports.aNetFields, function (field) {
                                try {
                                    currentRecord.setValue({fieldId: field, value: '', ignoreFieldChange: true});
                                    window.nlapiGetField(field).setDisplayType('hidden');
                                } catch (e) {
                                    log.error('issue with client hide / show . ', 'Missing field : ' + field);
                                }
                            });
                            _.forEach(nativeFields, function (field) {
                                try {
                                    window.nlapiGetField(field).setDisplayType('normal');
                                } catch (e) {
                                    log.error('issue with client hide / show . ', 'Missing field : ' + field);
                                }
                            });
                            //window.nlapiGetField('custbody_authnet_ccnumber').setDisplayType('hidden');
                            //window.nlapiGetField('custbody_authnet_ccexp').setDisplayType('hidden');
                            //window.nlapiGetField('custbody_authnet_ccv').setDisplayType('hidden');
                        }
                    }
                    else if (fieldName === 'custbody_authnet_override') {
                        if (currentRecord.getValue({fieldId: 'custbody_authnet_override'})) {
                            currentRecord.setValue({
                                fieldId: 'custbody_authnet_use',
                                value: false,
                                ignoreFieldChange: true
                            });
                            //this field is always required
                            currentRecord.setValue({fieldId :'paymentmethod', value : '', ignoreFieldChange: true});
                            //this one is sometimes required
                            if (o_config.hasPaymentInstruments) {
                                currentRecord.setValue({
                                    fieldId: (o_config.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'),
                                    value: '',
                                    ignoreFieldChange: true
                                });
                            }
                            currentRecord.setValue({
                                fieldId: 'custbody_authnet_done',
                                value: true,
                                ignoreFieldChange: true
                            });
                        }

                    }
                }
                else if (_.includes(['customerrefund'], context.currentRecord.type))
                {
                    if (fieldName === 'custbody_authnet_use') {
                        var a_txnIds = [];
                        for (var i = context.currentRecord.getLineCount('apply') - 1; i >= 0; i--) {
                            context.currentRecord.selectLine({sublistId: 'apply', line: i});
                            context.currentRecord.setCurrentSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                value: false,
                                ignoreFieldChange: true
                            });
                            context.currentRecord.commitLine({sublistId: 'apply'});
                            a_txnIds.push(context.currentRecord.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'doc',
                                line: i
                            }));
                        }
                        for (var i = context.currentRecord.getLineCount('deposit') - 1; i >= 0; i--) {
                            context.currentRecord.selectLine({sublistId: 'deposit', line: i});
                            context.currentRecord.setCurrentSublistValue({
                                sublistId: 'deposit',
                                fieldId: 'apply',
                                value: false,
                                ignoreFieldChange: true
                            });
                            context.currentRecord.commitLine({sublistId: 'deposit'});
                            a_txnIds.push(context.currentRecord.getSublistValue({
                                sublistId: 'deposit',
                                fieldId: 'doc',
                                line: i
                            }));
                        }
                        if (_.isEmpty(exports.sac) && !_.isEmpty(a_txnIds)) {
                            getApplyTxns (a_txnIds);
                        }

                        if (currentRecord.getValue('custbody_authnet_use')) {
                            try {
                                if (+currentRecord.getValue({fieldId: 'custbody_authnet_cim_token_type'}) !== 2) {
                                    //this field is always required
                                    currentRecord.setValue({fieldId :'paymentmethod', value : o_config.custrecord_an_paymentmethod.val,ignoreFieldChange: true});
                                    //this one is sometimes required
                                    if (o_config.hasPaymentInstruments) {
                                        currentRecord.setValue({
                                            fieldId: 'paymentoption',
                                            value: o_config.custrecord_an_paymentmethod.profileId,
                                            ignoreFieldChange: true
                                        });
                                    }
                                } else {
                                    //this field is always required
                                    currentRecord.setValue({fieldId :'paymentmethod', value : o_config.custrecord_an_paymentmethod_echeck.val,ignoreFieldChange: true});
                                    //this one is sometimes required
                                    if (o_config.hasPaymentInstruments) {
                                        currentRecord.setValue({
                                            fieldId: 'paymentoption',
                                            value: o_config.custrecord_an_paymentmethod_echeck.profileId,
                                            ignoreFieldChange: true
                                        });
                                    }
                                }
                                currentRecord.setValue({fieldId :'chargeit', value: false});
                            } catch (e) {
                                log.audit('Account does not have native cc-processing enabled');
                            }
                            _.forEach(nativeFields, function (field) {
                                try {
                                    window.nlapiGetField(field).setDisplayType('hidden');
                                    currentRecord.setValue({fieldId: field, value: ''});
                                } catch (e) {
                                    log.error('issue with client hide / show . ', 'Missing field : ' + field);
                                }
                            });
                            try {
                                currentRecord.setValue('creditcard', '');
                                currentRecord.setValue({fieldId: 'getauth', value: false});
                            } catch (e) {
                                log.debug('Native billing not enabled')
                            }
                        } else {
                            currentRecord.setText({fieldId:'paymentmethod', text:'', ignoreFieldChange: true});
                            if (o_config.hasPaymentInstruments) {
                                currentRecord.setText({
                                    fieldId: (o_config.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'),
                                    text: '',
                                    ignoreFieldChange: true
                                });
                            }
                            _.forEach(nativeFields, function (field) {
                                try {
                                    window.nlapiGetField(field).setDisplayType('normal');
                                } catch (e) {
                                    log.error('issue with client hide / show . ', 'Missing field : ' + field);
                                }
                            });
                        }
                    }
                    else if (fieldName === 'apply')
                    {
                        var b_useAuthNet = currentRecord.getValue('custbody_authnet_use');
                        //console.log(exports.sac);
                        var lineDate = context.currentRecord.getSublistValue({
                            sublistId: context.sublistId,
                            fieldId: context.sublistId + 'date',
                            line: context.line
                        });
                        var docId = context.currentRecord.getSublistValue({
                            sublistId: context.sublistId,
                            fieldId: 'doc',
                            line: context.line
                        });
                        //console.log(lineDate)
                        //console.log(docId)
                        //if the date for the apply is today - reject it outright
                        var m_authDate = moment(lineDate);
                        var m_midnight = moment().endOf('day').subtract(59, 'seconds');
                        //if we can void - we void

                        //if we are applying AND authnet is on
                        //console.log(context);
                        //console.log('sublist is '+context.sublistId);
                        //console.log('doc val is '+context.currentRecord.getSublistValue({sublistId: context.sublistId , fieldId: 'doc', line: context.line}));
                        var b_hasSAC = _.includes(exports.sac, +context.currentRecord.getSublistValue({
                            sublistId: context.sublistId,
                            fieldId: 'doc',
                            line: context.line
                        }));
                        //console.log('b_hasSAC '+b_hasSAC);
                        //console.log('b_useAuthNet '+b_useAuthNet);
                        //console.log('line date '+ context.currentRecord.getSublistValue({sublistId: context.sublistId , fieldId: 'apply', line: context.line}));
                        if (context.currentRecord.getSublistValue({
                            sublistId: context.sublistId,
                            fieldId: 'apply',
                            line: context.line
                        })) {
                            if (!b_useAuthNet && b_hasSAC) {
                                dialog.alert({title:'Selected transaction used Authorize.Net', message:'You are attempting to issue this Customer Refund on a transaction that captured funds using Authorize.Net.  To refund this transaction, you must first check the box "Use Authorize.Net" and then select this transaction'});
                                context.currentRecord.setCurrentSublistValue({
                                    sublistId: context.sublistId,
                                    fieldId: 'apply',
                                    value: false,
                                    ignoreFieldChange: true
                                });
                                context.currentRecord.setCurrentSublistValue({
                                    sublistId: context.sublistId,
                                    fieldId: 'amount',
                                    value: ''
                                });
                            } else if (b_useAuthNet && !b_hasSAC) {
                                if (context.sublistId === 'apply')
                                {
                                    dialog.alert({title:'Credit Memo\'s CAN NOT use Authorize.Net',
                                        message: 'Because a Credit Memo may be issued against an Invoice with multiple Payments / Deposits applied, it\'s not possible to use Authorize.Net here to issue a refund. You may either refund the customer via a check (most common) or issue the refund here via Refund Method of Cash and then utilize your Authorize.Net account to refund individual payments equaling the total refund - note that these will not show in your settlement reporting tools within NetSuite. <br><br>While this is frustrating, this issue is due to how both NetSuite and Authorize.Net work / do not work together.' });
                                }
                                else
                                {
                                    dialog.alert({title:'Selected transaction did not use Authorize.Net',
                                        message: 'You are attempting to issue this Customer Refund with Authorize.Net on a transaction that was not generated with Authorize.Net, you can only select transactions that captured funds using Authorize.Net. To refund this transaction, you must first uncheck the box "Use Authorize.Net" and then select this transaction'});
                                }
                                context.currentRecord.setCurrentSublistValue({
                                    sublistId: context.sublistId,
                                    fieldId: 'apply',
                                    value: false,
                                    ignoreFieldChange: true
                                });
                                context.currentRecord.setCurrentSublistValue({
                                    sublistId: context.sublistId,
                                    fieldId: 'amount',
                                    value: ''
                                });
                            } else if (b_useAuthNet && m_authDate.isSame(m_midnight, 'day')) {
                                //so this transaction looks like it's on the same day - let's see when the settlment is
                                var o_lineTransaction = search.lookupFields({
                                    type: 'transaction',
                                    id: docId,
                                    columns: [
                                        'type',
                                        'custbody_authnet_settle_date',
                                        'custbody_authnet_refid',
                                        'custbody_authnet_datetime'
                                    ]
                                });
                            }
                        }
                    }

                }
            }
    }

        /*exports.validateLine = function(context) {
            var currentRecord = context.currentRecord;
            if (_.includes(['customerrefund'], context.currentRecord.type)) {
                var b_useAuthNet = currentRecord.getValue('custbody_authnet_use');
                var b_hasSAC = _.includes(exports.sac, +context.currentRecord.getSublistValue({
                    sublistId: context.sublistId,
                    fieldId: 'doc',
                    line: context.line
                }));
                if (b_useAuthNet && !b_hasSAC){
                    alert('nope');
                    return false;
                } else {
                    return true;
                }
            }
        };*/

        function SAC_saveRecord(context){
            var b_canSave = true;
            console.log('SuiteAuthConnect >> FORM VALIDATION on SAVE! ');
            console.log(context.currentRecord.type +' : ' +context.currentRecord.isNew);
            console.log(JSON.stringify(context));
            var o_config = JSON.parse(window.sessionStorage.getItem("config") );
            //context = {"currentRecord":{"id":"8045","type":"salesorder","isDynamic":true,"prototype":{}},"mode":"edit"}
            if (_.includes(['salesorder', 'customerdeposit','customerpayment'],context.currentRecord.type) ||
                (context.currentRecord.type === 'cashsale' && !context.currentRecord.getValue({fieldId: 'createdfrom'})) )
            {
                if (o_config.hasMultiSubRuntime && context.currentRecord.getValue({fieldId: 'custbody_authnet_use'}))
                {
                    var o_uidata = JSON.parse(context.currentRecord.getValue({fieldId: 'custpage_sac_ui_data'}))
                    //console.log(o_uidata)
                    //var i_cardId = context.currentRecord.getValue({fieldId: 'custbody_authnet_cim_token'});
                    var o_usedCard = {id:context.currentRecord.getValue({fieldId: 'custbody_authnet_cim_token'}), subsidiary: context.currentRecord.getValue({fieldId: 'subsidiary'})};

                    if (!_.find(o_uidata.cards, o_usedCard))
                    {
                        dialog.alert({
                            title: 'Payment Token / Subsidiary Mismatch',
                            message: 'You have selected a Customer Profile / Token that is incompatible with the subsidiary of the transaction.  Please review the card prefix and the transaction subsidiary.'
                        });
                        b_canSave = false;
                    }
                }
                else if (context.currentRecord.getValue({fieldId: 'custbody_authnet_use'}) && !context.currentRecord.getValue({fieldId: 'custbody_authnet_cim_token'}))
                {
                    if (context.mode === 'create') {
                        //b_canSave = isReady(context.currentRecord);
                        b_canSave = false;
                        if (window.confirm('Some Authorize.Net information appears missing on this transaction (no token is found).  Do you want to attempt to save and see if the missing data can be located for you?  If you are creating a new transaction - you will want to verify the authorize.net charge was successful after you save under the "Authorize.Net" Tab')) {
                            b_canSave = true;
                            console.log('Overridden? ' + b_canSave);
                        }
                    }
                }
            }
            else if (context.currentRecord.type === 'customerrefund' && context.currentRecord.isNew)
            {
                if (context.currentRecord.getValue({fieldId: 'custbody_authnet_use'}))
                {
                    //look to see if any other line is selected and if it is, and it is a credit memo - stop it
                    var i_countCms = 0;
                    for (var i = context.currentRecord.getLineCount('apply') - 1; i >= 0; i--) {
                        if (context.currentRecord.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'apply',
                            line: i
                        }))
                        {
                            if (exports.txninfo[context.currentRecord.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'doc',
                                line: i
                            })].type === 'CustCred')
                            {
                                i_countCms++;
                            }
                        }
                    }
                    if (i_countCms > 1)
                    {
                        b_canSave = false;
                        dialog.alert({title:'Can NOT Process Simultaneous Credit Memo\'s',
                            message: 'Because of the relationships Credit Memo\'s have with multiple issuing records, it\'s not possible to use Authorize.Net to issue a single refund across multiple Credit Memos at the same time. <br>You may either refund the customer via a check (most common) or issue individual refunds per Credit Memo Record. <br><br>This issue is due to the differences in how NetSuite and Authorize.Net function.' });

                    }
                    if (!context.currentRecord.getValue({fieldId: (o_config.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod')}))
                    {
                        b_canSave = false;
                        dialog.alert({title:'Customer Refund Missing '+(o_config.hasPaymentInstruments ? 'Payment Option' : 'Payment Method'),
                            message: 'Please select the '+(o_config.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod')+' that should be used for this refund.' });
                    }
                }
            }
            return b_canSave;
        }

        return {
            pageInit: SAC_pageInit,
            fieldChanged: SAC_fieldChanged,
            postSourcing: SAC_postSourcing,
            //sublistChanged: SAC_sublistChanged,
            //lineInit: SAC_lineInit,
            //validateField: SAC_validateField,
            //validateLine: SAC_validateLine,
            //validateInsert: SAC_validateInsert,
            //validateDelete: SAC_validateDelete,
            saveRecord: SAC_saveRecord
        };
});