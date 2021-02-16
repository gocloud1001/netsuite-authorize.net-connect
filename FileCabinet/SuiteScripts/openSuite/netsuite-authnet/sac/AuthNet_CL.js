/**
 *
 * @copyright 2021 Cloud 1001, LLC
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
 * @author Cloud 1001, LLC <suiteauthconnect@gocloud1001.com>
 *
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 * @NModuleScope Public
 *
 * @NAmdConfig ../config.json
 */


define(['N/currentRecord', 'N/search', 'N/ui/message', 'lodash', 'moment'],
    function(currentRecord, search, message, _, moment) {
        var exports = {
            sac : []
        };

        exports.aNetFields = ['custbody_authnet_ccnumber', 'custbody_authnet_ccexp', 'custbody_authnet_ccv','custbody_authnet_cim_token'];

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

        function SAC_pageInit(context) {

            console.log('Giggity giggity - we are a GO for SuiteAuthConnect! ' + JSON.stringify(context))
            //context = {"currentRecord":{"id":"8045","type":"salesorder","isDynamic":true,"prototype":{}},"mode":"edit"}
            if (_.includes(['salesorder', 'cashsale','customerdeposit','customerpayment'],context.currentRecord.type)) {
                if (_.includes(['create', 'copy', 'edit'], context.mode)) {

                    _.forEach(exports.aNetFields, function(field){
                        try {
                            window.nlapiGetField(field).setDisplayType('hidden');
                        } catch (e){
                            log.error('issue with client hide / show . ', 'Missing field : ' + field);
                        }
                    });
                    if (_.includes(['salesorder', 'customerdeposit'], context.currentRecord.type)) {
                        //if this is a
                        if (context.currentRecord.getValue({fieldId: 'custbody_authnet_use'})) {
                            //window.nlapiDisableField('bullshitvanillialatte')
                        }
                    }
                }
                if (_.includes(['cashsale'], context.currentRecord.type)) {
                    //if this is a
                    if (context.currentRecord.getValue({fieldId: 'custbody_authnet_use'}) && !_.isEmpty(context.currentRecord.getValue({fieldId: 'custbody_authnet_refid'}))) {
                    }
                }
            } else if (_.includes(['customerrefund'], context.currentRecord.type)){
                try {
                    window.nlapiGetField('custbody_authnet_ccnumber').setDisplayType('hidden');
                    window.nlapiGetField('custbody_authnet_ccexp').setDisplayType('hidden');
                    window.nlapiGetField('custbody_authnet_ccv').setDisplayType('hidden');
                    window.nlapiGetField('custbody_authnet_refid').setDisplayType('hidden');
                    window.nlapiGetField('custbody_authnet_authcode').setDisplayType('hidden');
                    window.nlapiGetField('custbody_authnet_override').setDisplayType('hidden');
                    window.nlapiGetField('custbody_authnet_cim_token').setDisplayType('hidden');
                } catch (e){
                    console.log(e);
                }
            }
            //window.nlapiGetField('memo').setDisplayType('normal')
            //console.log(this)
        }

        function SAC_postSourcing(context) {
            var fieldName = context.fieldId;
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
                                {name: 'custbody_authnet_refid'},
                                {name: 'custbody_authnet_datetime'},
                                {name: 'custbody_authnet_authcode', sort: search.Sort.DESC}
                            ]
                        }).run().each(function (result) {
                            if (result.getValue('custbody_authnet_refid')) {
                                exports.sac.push(+result.getValue('internalid'));
                            }
                            console.log(result.getValue('internalid') + ' : ' + result.getValue('custbody_authnet_refid'));
                            return true;
                        });
                    }
                }

                if (context.currentRecord.getValue({fieldId: 'custbody_authnet_use'}) && !_.isEmpty(context.currentRecord.getValue({fieldId: 'custbody_authnet_refid'}))) {

                }
            }
        }

        function SAC_fieldChanged(context) {
            var currentRecord = context.currentRecord;
            var fieldName = context.fieldId;

            if(_.isNull(context.currentRecord.getField({fieldId: 'custpage_an_config'}))){
                Ext.MessageBox.alert('Configuration is Missing', 'The Authorize.Net User Event Script Is Not Deployed On This Form.  This transaction will not capture funds as expected without that script deployed.');
            } else {
                var o_config = JSON.parse(context.currentRecord.getValue({fieldId: 'custpage_an_config'}));
                var nativeFields = ['creditcard', 'ccnumber', 'ccexpiredate', 'creditcardprocessor', 'pnrefnum', 'authcode'];

                //explicitly disallow terms and auth.net on the same SO
                if (_.includes(['salesorder'], currentRecord.type)) {
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
                                    currentRecord.setValue({fieldId: field, value: ''});
                                    window.nlapiGetField(field).setDisplayType('hidden');
                                    console.log('hide ' + field)
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

                //cc field changes - set this field to auth net
                if (_.includes(['salesorder', 'cashsale', 'customerdeposit', 'customerpayment'], currentRecord.type)) {
                    if (fieldName === 'custbody_authnet_use') {
                        if (currentRecord.getValue({fieldId: 'custbody_authnet_use'})) {
                            try {
                                currentRecord.setValue('paymentmethod', o_config.custrecord_an_paymentmethod.val);
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
                                    currentRecord.setValue({fieldId: field, value: ''});
                                } catch (e) {
                                    log.error('issue with client hide / show . ', 'Missing field : ' + field);
                                }
                            });
                            //window.nlapiGetField('custbody_authnet_ccnumber').setDisplayType('normal');
                            //window.nlapiGetField('custbody_authnet_ccexp').setDisplayType('normal');
                            //window.nlapiGetField('custbody_authnet_ccv').setDisplayType('normal');
                            //window.nlapiGetField('creditcard').setDisplayType('hidden');

                            try {
                                currentRecord.setValue('creditcard', '');
                                currentRecord.setValue({fieldId: 'getauth', value: false});
                            } catch (e) {
                                log.debug('Native billing not enabled')
                            }
                            //window.nlapiDisableField('bullshit')
                        } else {
                            currentRecord.setText('paymentmethod', '');
                            //currentRecord.setValue('custbody_authnet_ccnumber', '');
                            //currentRecord.setValue('custbody_authnet_ccexp', '');
                            //currentRecord.setValue('custbody_authnet_ccv', '');
                            _.forEach(exports.aNetFields, function (field) {
                                try {
                                    currentRecord.setValue({fieldId: field, value: ''});
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
                    else if (fieldName === 'custbody_authnet_override'){
                        if (currentRecord.getValue({fieldId: 'custbody_authnet_override'})) {
                            currentRecord.setValue({fieldId:'custbody_authnet_use', value: false, ignoreFieldChange : true});
                            currentRecord.setValue({fieldId:'custbody_authnet_done', value: true, ignoreFieldChange : true});
                        }

                    }
                } else if (_.includes(['customerrefund'], context.currentRecord.type)) {
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
                            a_txnIds.push(context.currentRecord.getSublistValue({sublistId: 'apply' , fieldId: 'doc', line : i}));
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
                            a_txnIds.push(context.currentRecord.getSublistValue({sublistId: 'deposit' , fieldId: 'doc', line : i}));
                        }
                        if(_.isEmpty(exports.sac) && !_.isEmpty(a_txnIds)) {
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
                                    {name: 'custbody_authnet_refid'},
                                    {name: 'custbody_authnet_datetime'},
                                    {name: 'custbody_authnet_authcode', sort: search.Sort.DESC}
                                ]
                            }).run().each(function (result) {
                                if (result.getValue('custbody_authnet_refid')) {
                                    exports.sac.push(+result.getValue('internalid'));
                                }
                                //console.log(result.getValue('internalid') + ' : ' + result.getValue('custbody_authnet_refid'));
                                return true;
                            });
                        }

                        if (currentRecord.getValue('custbody_authnet_use')) {
                            currentRecord.setText('paymentmethod', 'Authorize.Net');
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
                            currentRecord.setText('paymentmethod', '');
                            _.forEach(nativeFields, function (field) {
                                try {
                                    window.nlapiGetField(field).setDisplayType('normal');
                                } catch (e) {
                                    log.error('issue with client hide / show . ', 'Missing field : ' + field);
                                }
                            });
                        }
                    } else if (fieldName === 'apply') {
                        //console.log(exports.sac);
                        var b_useAuthNet = currentRecord.getValue('custbody_authnet_use');
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
                        console.log(lineDate)
                        console.log(docId)
                        //if the date for the apply is today - reject it outright
                        var m_authDate = moment(lineDate);
                        var m_midnight = moment().endOf('day').subtract(59, 'seconds');
                        //if we can void - we void
                        if (b_useAuthNet && m_authDate.isSame(m_midnight, 'day')) {
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
                            //console.log(o_lineTransaction)
                            //o_lineTransaction.type[0].value === 'CustCred' //credit memo
                            //it has a settlement date - so the funds have been captured - so let's do this
                            if (o_lineTransaction.type[0].value === 'CustCred' && (o_lineTransaction.custbody_authnet_settle_date || moment(o_lineTransaction.custbody_authnet_datetime).isBefore(m_midnight))) {
                                //this passes muster here becasue it's a credit memo and has settlment from a cash sale thats older
                            } else {
                                alert('This transaction is from today and may not have voided so it can not be refunded - go to the transaction and void it directly on the Authorize.Net History Record.');
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
                            }
                        } else {
                            //if we are applying AND authnet is on
                            //console.log(context);
                            //console.log('sublist is '+context.sublistId);
                            //console.log('doc val is '+context.currentRecord.getSublistValue({sublistId: context.sublistId , fieldId: 'doc', line: context.line}));
                            var b_hasSAC = _.includes(exports.sac, +context.currentRecord.getSublistValue({
                                sublistId: context.sublistId,
                                fieldId: 'doc',
                                line: context.line
                            }));
                            //console.log('b_useAuthNet '+b_useAuthNet);
                            //console.log('line date '+ context.currentRecord.getSublistValue({sublistId: context.sublistId , fieldId: 'apply', line: context.line}));
                            if (b_useAuthNet !== b_hasSAC && context.currentRecord.getSublistValue({
                                sublistId: context.sublistId,
                                fieldId: 'apply',
                                line: context.line
                            })) {
                                Ext.MessageBox.alert('Selected transaction did not use Authorize.Net', 'You are attempting to issue this Customer Refund with Authorize.Net, you can only select transactions that captured funds using Authorize.Net.');
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
                            }
                        }
                    }
                }
            }
        };

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
        function isReady(thisRec){
            var b_isValid = true;
            var o_ccTypes = {
                3 : 'Amex',
                4 : 'Visa',
                5 : 'Master Card',
                6 : 'Discover'
            };
            if (!thisRec.getValue({fieldId: 'custbody_authnet_cim_token'})) {
                var cardNum = thisRec.getValue({fieldId: 'custbody_authnet_ccnumber'});
                var b_goodCard;
                if ((_.includes([4, 5, 6], +cardNum[0]) && cardNum.length === 16)) {
                    b_goodCard = true;
                } else if (+cardNum[0] === 3 && cardNum.length >= 15){
                    b_goodCard = true;
                } else {
                    b_goodCard = false;
                }
                var expDate = thisRec.getValue({fieldId: 'custbody_authnet_ccexp'});
                var m_expDate = moment(expDate, 'MMYY').endOf('month');
                var b_goodExp = (expDate.length === 4 && m_expDate.isSameOrAfter(moment().endOf('month')));
                var ccv = thisRec.getValue({fieldId: 'custbody_authnet_ccv'});
                var b_goodcvv = ccv.length <= 4 && ccv.length > 2;
                var s_error = '';
                if (!b_goodCard) {
                    if (_.isUndefined(o_ccTypes[cardNum[0]])){
                        s_error += 'A Credit Card or a Token has not been entered for this transaction, please review the entered payment information';
                        b_goodExp = true;
                        b_goodcvv = true;
                    } else {
                        s_error += 'Invalid Card Number - recheck this ' + o_ccTypes[cardNum[0]] + '<br>';
                    }
                }
                if (!b_goodExp) {
                    if (!expDate){
                        s_error += ' Missing Expiration Date <br>';
                    } else {
                        s_error += ' Invalid Expiration Date - ' + moment(expDate, 'MMYY').format('MMMM YYYY') + ' has passed<br>';
                    }
                }
                if (!b_goodcvv) {
                    s_error += ' Invalid CVV Format - must be 3 or 4 numbers<br>';
                }
                if (s_error.length > 0) {
                    b_isValid = false;
                    Ext.MessageBox.alert('Credit Card Issue', s_error);
                }
            }

            return b_isValid;
        }


        function SAC_saveRecord(context){
            var b_canSave = true;
            console.log('SuiteAuthConnect >> FORM VALIDATION on SAVE! ' + JSON.stringify(context))
            //context = {"currentRecord":{"id":"8045","type":"salesorder","isDynamic":true,"prototype":{}},"mode":"edit"}
            if (_.includes(['salesorder', 'customerdeposit','customerpayment'],context.currentRecord.type) ||
                (context.currentRecord.type === 'cashsale' && !context.currentRecord.getValue({fieldId: 'createdfrom'})) ) {
                if (context.currentRecord.getValue({fieldId: 'custbody_authnet_use'}) && _.isEmpty(context.currentRecord.getValue({fieldId: 'custbody_authnet_refid'}))) {
                    b_canSave = isReady(context.currentRecord);
                }
            }

            return b_canSave;
        };

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