/**
 * @exports XXX
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
 * @NApiVersion 2.0
 * @NModuleScope Public
 * @NScriptType Suitelet
 *
 * @NAmdConfig ../config.json
 *
 */
define(['N/record', 'N/runtime', 'N/error', 'N/search', 'N/log', 'N/ui/serverWidget', 'N/url', 'N/file', 'N/render', 'N/redirect', 'N/task', 'lodash', './AuthNet_lib', 'moment'],
    function (record, runtime, error, search, log, ui, url, file, render, redirect, task, _, authNet, moment) {


//https://system.sandbox.netsuite.com/app/site/hosting/scriptlet.nl?script=153&deploy=1&compid=3686238&number=XXXX1111&soid=1411554&code=3&type=Visa&hash=B7B643FEBF2276A3D890378D0A1C805D&errorcode=11&errortxt=A+duplicate+transaction+has+been+submitted.&whence=&cmid=1512076831433_8210
        function onRequest(context) {
            if (context.request.method === 'GET'){
                var o_config2 = authNet.getConfigFromCache();
                var o_params = context.request.parameters, o_history, o_anResponse;
                //log.debug('context.request.parameters', o_params);
                if (o_params.historyId) {
                    o_history = record.load({
                        type: 'customrecord_authnet_history',
                        id: o_params.historyId,
                        isDynamic: true
                    });
                    //log.debug('o_history',o_history)
                    try {
                        //log.debug('pre objectified things', o_history.getValue('custrecord_an_response'))
                        o_anResponse = JSON.parse(o_history.getValue('custrecord_an_response'));
                        //log.debug('succesffuly objectified things', o_anResponse)

                        var historyUrl = url.resolveRecord({
                            recordType: 'customrecord_authnet_history',
                            recordId: o_params.historyId,
                            isEditMode: false
                        });
                        //todo - load a standard HTML file as the template for future changes
                        /*
                        var emlTmplFile = file.load(10115);
                        var myFile = render.create();
                        myFile.templateContent = emlTmplFile.getContents();
                        myFile.addCustomDataSource(
                            {
                                format: render.DataSource.OBJECT,
                                alias: "CUST_JSON",
                                data: empCommissions
                            });
                        var s_body = myFile.renderAsString();
                        */

                        switch (o_history.getValue('custrecord_an_calledby')) {
                            case 'customerdeposit':
                                log.debug('customerdeposit object o_anResponse', o_anResponse);
                                if(_.isUndefined(o_anResponse.transactionResponse)){
                                    template = template.replace(/%%MESSAGES%%/g, o_history.getValue({fieldId: 'custrecord_an_response_message'}));
                                    var s_errors = o_history.getValue({fieldId: 'custrecord_an_response_ig_advice'})  + ' (' +o_history.getValue({fieldId: 'custrecord_an_error_code'})+')';

                                    template = template.replace(/%%ERROR%%/g, s_errors);
                                    template = template.replace(/%%CODE%%/g, '');
                                    template = template.replace(/%%transHash%%/g, '');
                                    template = template.replace(/%%cardData%%/g, '');
                                    template = template.replace(/%%LOG%%/g, historyUrl);

                                } else {
                                    var s_restResponse = o_anResponse.transactionResponse.responseCode;
                                    template = template.replace(/%%MESSAGES%%/g, o_history.getValue({fieldId: 'custrecord_an_response_message'}));
                                    var s_errors = o_history.getValue({fieldId: 'custrecord_an_response_ig_advice'})  + ' (' +o_history.getValue({fieldId: 'custrecord_an_error_code'})+')';

                                    template = template.replace(/%%ERROR%%/g, s_errors);
                                    var s_messages = '';
                                    _.forEach(o_anResponse.messages.message, function (message) {
                                        s_messages += '<p>' + message.code + ' : ' + message.text + '</p>'
                                    });
                                    template = template.replace(/%%CODE%%/g, s_messages);
                                    template = template.replace(/%%transHash%%/g, 'ID: ' + o_history.getValue({fieldId: 'custrecord_an_refid'}));
                                    template = template.replace(/%%cardData%%/g, o_history.getValue({fieldId: 'custrecord_an_card_type'}) + ' ending in ' + o_history.getValue({fieldId: 'custrecord_an_cardnum'}));
                                    template = template.replace(/%%LOG%%/g, historyUrl);
                                }
                                context.response.write(template);
                                break;
                            case 'customerpayment':
                                log.debug('object o_anResponse', o_anResponse);
                                template = template.replace(/%%MESSAGES%%/g, o_history.getValue({fieldId: 'custrecord_an_response_message'}));
                                var s_errors = o_history.getValue({fieldId: 'custrecord_an_response_ig_advice'})  + ' (' +o_history.getValue({fieldId: 'custrecord_an_error_code'})+')';
                                template = template.replace(/%%ERROR%%/g, s_errors);
                                var s_messages = '';
                                _.forEach(o_anResponse.messages.message, function (message) {
                                    s_messages += '<p>' + message.code + ' : ' + message.text + '</p>'
                                });
                                template = template.replace(/%%CODE%%/g, s_messages);
                                template = template.replace(/%%transHash%%/g, 'ID: ' + o_history.getValue({fieldId: 'custrecord_an_refid'}));
                                template = template.replace(/%%cardData%%/g, o_history.getValue({fieldId: 'custrecord_an_card_type'}) + ' ending in ' + o_history.getValue({fieldId: 'custrecord_an_cardnum'}));
                                template = template.replace(/%%LOG%%/g, historyUrl);
                                context.response.write(template);
                                //orgid is the payment ot pull data from before
                                break;
                            case 'cashsale':
                                log.debug('object o_anResponse', o_anResponse);
                                template = template.replace(/%%MESSAGES%%/g, o_history.getValue({fieldId: 'custrecord_an_response_message'}));
                                var s_errors = o_history.getValue({fieldId: 'custrecord_an_response_ig_advice'})  + ' (' +o_history.getValue({fieldId: 'custrecord_an_error_code'})+')';
                                template = template.replace(/%%ERROR%%/g, s_errors);

                                template = template.replace(/%%CODE%%/g, o_history.getValue({fieldId: 'custrecord_an_response_status'}));
                                template = template.replace(/%%transHash%%/g, 'ID: ' + o_history.getValue({fieldId: 'custrecord_an_refid'}));
                                template = template.replace(/%%cardData%%/g, o_history.getValue({fieldId: 'custrecord_an_card_type'}) + ' ending in ' + o_history.getValue({fieldId: 'custrecord_an_cardnum'}));
                                template = template.replace(/%%LOG%%/g, historyUrl);
                                context.response.write(template);
                                break;
                            case 'cashrefund':
                                log.debug('object o_anResponse', o_anResponse);
                                var error_string = '';
                                if (o_history.getValue({fieldId: 'custrecord_an_response_ig_advice'})){
                                    error_string = '<p><i>'+o_history.getValue({fieldId: 'custrecord_an_response_ig_advice'})+'</i>'
                                }
                                if (o_history.getValue({fieldId: 'custrecord_an_response_ig_other'})){
                                    error_string = '<p><i>'+o_history.getValue({fieldId: 'custrecord_an_response_ig_other'})+'</i>'
                                }
                                template = template.replace(/%%ERROR%%/g, o_history.getValue({fieldId: 'custrecord_an_response_message'}) + ' (' +o_history.getValue({fieldId: 'custrecord_an_error_code'}) + ')');
                                template = template.replace(/%%MESSAGES%%/g, error_string);
                                var s_messages = '';
                                _.forEach(o_anResponse.messages.message, function (message) {
                                    s_messages += '<p>' + message.code + ' : ' + message.text + '</p>'
                                });
                                template = template.replace(/%%CODE%%/g, s_messages);
                                template = template.replace(/%%transHash%%/g, 'ID: ' + o_history.getValue({fieldId: 'custrecord_an_refid'}));
                                template = template.replace(/%%cardData%%/g, o_history.getValue({fieldId: 'custrecord_an_card_type'}) + ' ending in ' + o_history.getValue({fieldId: 'custrecord_an_cardnum'}));
                                template = template.replace(/%%LOG%%/g, historyUrl);
                                context.response.write(template);
                                break;


                            default:
                                context.response.write('Nothing provided - so maybe you are just saying hello! Hi!');
                                break;
                        }
                    } catch (ex) {
                        log.error(ex.name, ex.message)
                        o_anResponse = o_history.getValue('custrecord_an_response');
                    }
                } else if (o_params.csissue) {
                    template = template.replace(/%%MESSAGES%%/g, 'This cash sale was not processed - no capture was generated becasue the conditions of this cash sale did not pass the plugin logic you have configured for processing cash sales');
                    template = template.replace(/%%ERROR%%/g, 'This transaction did not pass the SuiteAuthConnect Plugin Logic for Processing');
                    template = template.replace(/%%CODE%%/g, 'Funds Not Captured / Order not billed');
                    template = template.replace(/%%transHash%%/g, '');
                    template = template.replace(/%%cardData%%/g, '');
                    template = template.replace(/%%LOG%%/g, '');
                    context.response.write(template);
                }
                else if (o_params.doAuthVoid)
                {
                    var historyRecord = record.load({
                        type: o_params._type,
                        id: o_params._id,
                        isDynamic : true
                    });

                    var txn = record.load({
                        type: historyRecord.getValue({fieldId: 'custrecord_an_calledby'}),
                        id: historyRecord.getValue({fieldId: 'custrecord_an_txn'}),
                        isDynamic : true
                    });
                    txn.setValue({fieldId: 'custrecord_an_txn', value : historyRecord.getValue({fieldId:'custbody_authnet_refid'})});
                    var o_parsed = authNet.doVoid(txn);
                    authNet.homeSysLog('o_parsed from doVoid', o_parsed);

                    if (o_parsed.status){
                        //it voided - so we need to change the auth and the sales order
                        historyRecord.setValue({fieldId:'custrecord_an_response_status', value: 'VOIDED'});
                        historyRecord.save();
                        //now clear the transaction
                        txn.setValue({fieldId:'custbody_authnet_use', value: false});
                        txn.setValue({fieldId:'custbody_authnet_cim_token', value: ''});
                        txn.setValue({fieldId:'custbody_authnet_refid', value: ''});
                        txn.setValue({fieldId:'custbody_authnet_authcode', value: ''});
                        txn.setValue({fieldId:'custbody_authnet_datetime', value: ''});
                        txn.save({ignoreMandatoryFields : true});
                    }
                    context.response.write(JSON.stringify(o_parsed))
                    //call the auth to see if we can void it
                }
                else if (o_params.getCIM)
                {
                    var historyRecord = record.load({
                        type: o_params._type,
                        id: o_params._id,
                        isDynamic : true
                    });

                    var o_getCIMResponse = JSON.parse(historyRecord.getValue('custrecord_an_response'));

                    var o_profile =  {
                        nsEntityId : historyRecord.getValue('custrecord_an_customer'),
                        customerProfileId : o_getCIMResponse.customerProfileId,
                        customerPaymentProfileIdList : o_getCIMResponse.customerPaymentProfileIdList}
                    authNet.makeToken(o_profile, o_config2);
                    var o_parsed = {status : true, customer:historyRecord.getValue('custrecord_an_customer')};
                    context.response.write(JSON.stringify(o_parsed))
                    //call the auth to see if we can void it
                }
                else if (o_params.debugger === 'totallytrue')
                {
                    ///app/site/hosting/scriptlet.nl?script=632&deploy=1&debugger=totallytrue
                    var form = ui.createForm({
                        title: 'CLOUD 1001, LLC Authorize.Net Platform Debugger - USE AT YOUR OWN PERIL!',
                        hideNavBar : false
                    });

                    //generic for all tests
                    var generic = form.addFieldGroup({
                        id: 'grpgeneric',
                        label: 'Fields all tests might use'
                    });
                    var customer = form.addField({
                        id: 'custid',
                        type: ui.FieldType.SELECT,
                        source : 'customer',
                        label: 'Customer',
                        container: 'grpgeneric'
                    });
                    customer.defaultValue = '1647';
                    form.addField({
                        id: 'txnid',
                        type: ui.FieldType.TEXT,
                        label: 'Internal ID of Transaction',
                        container: 'grpgeneric'
                    });
                    form.addField({
                        id: 'txntype',
                        type: ui.FieldType.TEXT,
                        label: 'Type of Transaction for ID',
                        container: 'grpgeneric'
                    });

                    var items = form.addField({
                        id: 'itemlist',
                        type: ui.FieldType.TEXT,
                        label: 'Items - in array object {qty, itemid, rate}',
                        container: 'grpgeneric'
                    });
                    items.defaultValue = '[{"item" : "1061", "quantity" : "1", "amount": "10.12"}]';
                    var ccnum = form.addField({
                        id: 'ccnum',
                        type: ui.FieldType.TEXT,
                        label: 'Card Number',
                        container: 'grpgeneric'
                    });
                    ccnum.defaultValue = '4111111111111111';
                    var exp = form.addField({
                        id: 'ccexp',
                        type: ui.FieldType.TEXT,
                        label: 'Card Exp (MMYY)',
                        container: 'grpgeneric'
                    });
                    exp.defaultValue = '1122';
                    var cvv = form.addField({
                        id: 'ccv',
                        type: ui.FieldType.TEXT,
                        label: 'CCV',
                        container: 'grpgeneric'
                    });
                    cvv.defaultValue = '111';
                    form.addField({
                        id: 'tokenid',
                        type: ui.FieldType.TEXT,
                        label: 'InternalId of Token Record',
                        container: 'grpgeneric'
                    });

                    form.addField({
                        id: 'billzip',
                        type: ui.FieldType.TEXT,
                        label: 'Billing Zip for testing response handling',
                        container: 'grpgeneric'
                    });
                    form.addField({
                        id: 'extrafields',
                        type: ui.FieldType.TEXT,
                        label: 'Array of field key : value pairs',
                        container: 'grpgeneric'
                    });


                    //auth - UI
                    var grp_authin = form.addFieldGroup({
                        id: 'grpauthin',
                        label: 'Create internal auth (SO)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'getAuth()',
                        source: 'makeso',
                        container: 'grpauthin'
                    });

                    //external auth record test
                    var grp_validAuth = form.addFieldGroup({
                        id: 'grpauthcheck',
                        label: 'Get the status of an auth event by tranid'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'getStatusCheck()',
                        source: 'getstatus',
                        container: 'grpauthcheck'
                    });

                    form.addField({
                        id: 'custpage_tranrefid',
                        type: ui.FieldType.TEXT,
                        label: 'tranrefid',
                        container: 'grpauthcheck'
                    });

                    //external auth record test
                    var grp_authout = form.addFieldGroup({
                        id: 'grpauthout',
                        label: 'Create EXTERNAL auth (SO with external auth data)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'madeSOwirtExternalAuth()',
                        source: 'makeextso',
                        container: 'grpauthout'
                    });

                    form.addField({
                        id: 'refid',
                        type: ui.FieldType.TEXT,
                        label: 'refid',
                        container: 'grpauthout'
                    });
                    form.addField({
                        id: 'externalorderid',
                        type: ui.FieldType.TEXT,
                        label: 'External Order ID',
                        container: 'grpauthout'
                    });



                    //capture off so
                    var grp_capture = form.addFieldGroup({
                        id: 'grpcapture',
                        label: 'Capture Off SO (SO --> CS)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'captureOffSO()',
                        source: 'captureoffso',
                        container: 'grpcapture'
                    });
                    form.addField({
                        id: 'sotocsid',
                        type: ui.FieldType.TEXT,
                        label: 'SO Internal ID to capture!',
                        container: 'grpcapture'
                    });



                    //direct capture
                    var grp_directcapture = form.addFieldGroup({
                        id: 'grpdircapture',
                        label: 'Direct Capture (standalone CS)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'makeCashSale().authCapture()',
                        source: 'makecs',
                        container: 'grpdircapture'
                    });

                    //deposit capture
                    var grp_depositcapture = form.addFieldGroup({
                        id: 'grpdepositcapture',
                        label: 'Make SO for INV and Capture Deposit'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'makeDeposit().authCapture()',
                        source: 'makedeposit',
                        container: 'grpdepositcapture'
                    });


                    //refund
                    //testing of CIM logic to pull from TXN
                    var grp_cim = form.addFieldGroup({
                        id: 'grpcim',
                        label: 'CIM / Profile Testing'
                    });

                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'getCIM()',
                        source: 'cim',
                        container: 'grpcim'
                    });

                    //error log parsing / display
                    var grp_history = form.addFieldGroup({
                        id: 'grphistory',
                        label: 'History Record Testing'
                    });

                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'reparseHistory()',
                        source: 'history',
                        container: 'grphistory'
                    });
                    form.addField({
                        id: 'historyid',
                        type: ui.FieldType.TEXT,
                        label: 'historyid',
                        container: 'grphistory'
                    });

                    //error parser test URL to laod history record
                    //https://tstdrv1273352.app.netsuite.com/app/site/hosting/scriptlet.nl?script=632&deploy=1&compid=TSTDRV1273352&historyId=256&from=cashrefund&orgid=10223&whence=&cmid=1562071995479_1458


                    form.addSubmitButton({
                        label: 'Perform Test'
                    });

                    context.response.writePage( form );
                }
                else if (o_params.seeRecord === 'true' && o_params._id && o_params._type)
                {
                    try {


                        var recordJSON = record.load({
                            type: o_params._type,
                            id: o_params._id
                        }).toJSON();
                        context.response.write(JSON.stringify(recordJSON))
                    } catch (e){
                        context.response.write(e.name + ' :: '+e.message);
                    }
                }
                else
                {
                /*template = template.replace(/%%MESSAGES%%/g, 'TRANSACTION HAS BEEN CHARGED - CAN NOT DELETE');
                template = template.replace(/%%ERROR%%/g, 'Deletion Not Allowed');
                template = template.replace(/%%CODE%%/g, 'Already Charged');
                template = template.replace(/%%transHash%%/g, '');
                template = template.replace(/%%cardData%%/g, '');
                template = template.replace(/%%LOG%%/g, '');
                context.response.write(template);*/

                //SETUP stage here
                //var o_config = authNet.getActiveConfig();
                if (_.isEmpty(o_config2)){
                    //autorun the config script
                    try {
                        var scriptTask = task.create({
                            taskType: task.TaskType.SCHEDULED_SCRIPT,
                            scriptId: 'customscript_sac_ss2_update_cfg',
                            deploymentId: 'customdeploy_sac_ss2_update_cfg_o'
                        });
                        var scriptTaskId = scriptTask.submit();
                        //log.debug('scriptTaskId', scriptTaskId)
                        log.audit('Process for intial setup is running ', task.checkStatus(scriptTaskId));
                        context.response.write('Initial setup and configuraton is taking place - you may need to wait a moment and reload this page.');
                    } catch (ex){
                        context.response.write('Initial setup and configuraton is STILL taking place - you may need to wait a moment and reload this page.');
                    }
                } else {
                    redirect.toRecord({
                        type: 'customrecord_authnet_config',
                        id: o_config2.id,
                        isEditMode: !o_config2.custrecord_an_enable.val,
                        parameters: {'custparam_issetup': 'true'}
                    });
                }

                }

            } else {
                log.debug('POST');
                log.debug('context.request.parameters', context.request.parameters);
                //context.response.write(JSON.stringify(context.request.parameters));
                var o_params = context.request.parameters;
                var o_config2 = authNet.getConfigFromCache();
                var o_response = {'OK':null};
                switch (o_params.custpage_test){
                    case 'getstatus':
                        o_response.OK = true;
                        o_response.responseFrom_getStatusCheck = authNet.getStatusCheck(o_params.custpage_tranrefid);
                        break;

                    case 'makeso':
                        //make the so and set all the fields and save...
                        var testSo = record.create({
                            type: 'salesorder',
                            isDynamic : true
                        });
                        testSo.setValue({fieldId: 'entity', value : o_params.custid });
                        log.debug('must parse this string array', o_params.itemlist)
                        var a_item = JSON.parse(o_params.itemlist);
                        _.forEach(a_item, function(line){
                            log.debug('this is the line being added: '+ line.item, line)
                            testSo.selectNewLine({sublistId:'item'});
                            testSo.setCurrentSublistValue({sublistId:'item', fieldId:'item', value:line.item});
                            testSo.setCurrentSublistValue({sublistId:'item', fieldId:'quantity', value:line.quantity});
                            //testSo.setCurrentSublistText({sublistId:'item', fieldId:'price', text:'Custom'});
                            testSo.setCurrentSublistValue({sublistId:'item', fieldId:'amount', value:line.amount});
                            testSo.commitLine({sublistId:'item'});
                        });

                        //todo - accept billing zip change

                        testSo.setValue({fieldId: 'custbody_authnet_use', value : true });
                        testSo.setValue({fieldId: 'orderstatus', value : 'B' });
                        if (o_params.tokenid){
                            testSo.setValue({fieldId: 'custbody_authnet_cim_token', value : o_params.tokenid });
                        } else {
                            testSo.setValue({fieldId: 'custbody_authnet_ccnumber', value: o_params.ccnum});
                            testSo.setValue({fieldId: 'custbody_authnet_ccexp', value: o_params.ccexp});
                            testSo.setValue({fieldId: 'custbody_authnet_ccv', value: o_params.ccv});
                        }

                        o_response.OK = testSo.save();
                        break;
                    case 'makeextso':
                        var testSo = record.create({
                            type: 'salesorder',
                            isDynamic : true
                        });
                        testSo.setValue({fieldId: 'entity', value : o_params.custid });
                        if (!_.isEmpty(o_params.extrafields)) {
                            var a_extras = JSON.parse(o_params.extrafields);
                            log.debug('any extra fields: ', a_extras)
                            _.forEach(a_extras, function (data) {
                                _.forEach(data, function (val, kie) {
                                    log.debug('kie: ' + kie, val);
                                    testCS.setValue({fieldId: kie, value: val});
                                });
                            });
                        }

                        log.debug('must parse this string array', o_params.itemlist)
                        var a_item = JSON.parse(o_params.itemlist);
                        _.forEach(a_item, function(line){
                            log.debug('this is the line being added: '+ line.item, line)
                            testSo.selectNewLine({sublistId:'item'});
                            _.forEach(line, function(val, kie){
                                testSo.setCurrentSublistValue({sublistId:'item', fieldId:kie, value:val});
                            });
                            testSo.commitLine({sublistId:'item'});
                        });
                        testSo.setValue({fieldId: 'custbody_authnet_refid', value: o_params.refid});
                        //load the config and get the field we need for the "external order number
                        //var o_config = authNet.getActiveConfig(testSo);
                        //log.debug('o_config', o_config)
                        testSo.setValue({fieldId:o_config.custrecord_an_external_fieldid.val, value :o_params.externalorderid});
                        o_response.OK = testSo.save();

                        break;
                    case 'captureoffso':
                        var o_customerBill = record.transform({
                            fromType: 'salesorder',
                            fromId: o_params.sotocsid,
                            toType: 'cashsale',
                            isDynamic: true
                        });
                        o_response.OK = o_customerBill.save();
                        break;

                    case 'makecs':
                        var testCS = record.create({
                            type: 'cashsale',
                            isDynamic : true
                        });
                        testCS.setValue({fieldId: 'entity', value : o_params.custid });
                        if (!_.isEmpty(o_params.extrafields)) {
                            var a_extras = JSON.parse(o_params.extrafields);
                            log.debug('any extra fields: ', a_extras)
                            _.forEach(a_extras, function (data) {
                                _.forEach(data, function (val, kie) {
                                    log.debug('kie: ' + kie, val);
                                    testCS.setValue({fieldId: kie, value: val});
                                });
                            });
                        }
                        log.debug('must parse this string array', o_params.itemlist)
                        var a_item = JSON.parse(o_params.itemlist);
                        _.forEach(a_item, function(line){
                            log.debug('this is the line being added: '+ line.item, line)
                            testCS.selectNewLine({sublistId:'item'});
                            _.forEach(line, function(val, kie){
                                testCS.setCurrentSublistValue({sublistId:'item', fieldId:kie, value:val});
                            });
                            testCS.commitLine({sublistId:'item'});
                        });


                        //todo - accept billing zip change

                        testCS.setValue({fieldId: 'custbody_authnet_use', value : true });
                        //var o_config = authNet.getActiveConfig(testCS);
                        testCS.setValue({fieldId:'paymentmethod', value: o_config2.custrecord_an_paymentmethod.val});

                        if (o_params.tokenid){
                            testCS.setValue({fieldId: 'custbody_authnet_cim_token', value : o_params.tokenid });
                        } else {
                            testCS.setValue({fieldId: 'custbody_authnet_ccnumber', value: o_params.ccnum});
                            testCS.setValue({fieldId: 'custbody_authnet_ccexp', value: o_params.ccexp});
                            testCS.setValue({fieldId: 'custbody_authnet_ccv', value: o_params.ccv});
                        }

                        o_response.OK = testCS.save();
                        break;
                    case 'makedeposit':
                        //todo - transform SO without auth into deposit for that SO!
                        var testSo = record.create({
                            type: 'salesorder',
                            isDynamic : true
                        });
                        testSo.setValue({fieldId: 'entity', value : o_params.custid });
                        if (!_.isEmpty(o_params.extrafields)) {
                            var a_extras = JSON.parse(o_params.extrafields);
                            log.debug('any extra fields: ', a_extras)
                            _.forEach(a_extras, function (data) {
                                _.forEach(data, function (val, kie) {
                                    log.debug('kie: ' + kie, val);
                                    testCS.setValue({fieldId: kie, value: val});
                                });
                            });
                        }

                        log.debug('must parse this string array', o_params.itemlist)
                        var a_item = JSON.parse(o_params.itemlist);
                        _.forEach(a_item, function(line){
                            log.debug('this is the line being added: '+ line.item, line)
                            testSo.selectNewLine({sublistId:'item'});
                            _.forEach(line, function(val, kie){
                                testSo.setCurrentSublistValue({sublistId:'item', fieldId:kie, value:val});
                            });
                            testSo.commitLine({sublistId:'item'});
                        });

                        testSo.setValue({fieldId:'paymentmethod', value :''});
                        o_response.SO = testSo.save();

                        var o_customerDeposit = record.create({
                            type: 'customerdeposit',
                            disablepaymentfilters: true,
                            isDynamic: true
                        });
                        o_customerDeposit.setValue({fieldId: 'customer', value:  testSo.getValue({fieldId: 'entity'})});
                        o_customerDeposit.setValue({fieldId: 'salesorder', value:  o_response.SO});
                        o_customerDeposit.setValue({fieldId:'payment', value: +testSo.getValue({fieldId: 'total'}) / 2 });

                        o_customerDeposit.setValue({fieldId: 'custbody_authnet_use', value : true });
                        o_customerDeposit.setValue({fieldId: 'undepfunds', value : 'F' });
                        o_customerDeposit.setValue({fieldId: 'account', value : 186 });

                        if (o_params.tokenid){
                            o_customerDeposit.setValue({fieldId: 'custbody_authnet_cim_token', value : o_params.tokenid });
                        } else {
                            o_customerDeposit.setValue({fieldId: 'custbody_authnet_ccnumber', value: o_params.ccnum});
                            o_customerDeposit.setValue({fieldId: 'custbody_authnet_ccexp', value: o_params.ccexp});
                            o_customerDeposit.setValue({fieldId: 'custbody_authnet_ccv', value: o_params.ccv});
                        }

                        o_response.OK = o_customerDeposit.save();

                        break;
                    case 'cim':
                        var thisRec=record.load({
                            type : o_params.txntype,
                            id: o_params.txnid,
                            isDynamic: true });
                        //var o_config = authNet.getActiveConfig(thisRec);
                        o_response = authNet.getCIM(thisRec, o_config2);
                        break;
                    case 'history':
                        //load the history record - get the JSON - reparse it to test parsing logic enhancements
                        var originalhistRec = record.load({
                            type : 'customrecord_authnet_history',
                            id: o_params.historyid,
                            isDynamic: true });

                        var newHistRec = record.create({
                            type : 'customrecord_authnet_history',
                            isDynamic: true });

                        newHistRec.setValue({fieldId:'custrecord_an_calledby', value: originalhistRec.getValue({fieldId:'custrecord_an_calledby'})})
                        newHistRec.setValue({fieldId:'custrecord_an_call_type', value: originalhistRec.getValue({fieldId:'custrecord_an_call_type'})})
                        newHistRec.setValue({fieldId:'custrecord_an_amount', value: originalhistRec.getValue({fieldId:'custrecord_an_amount'})})
                        var txnRec = record.load({
                            type : originalhistRec.getValue({fieldId:'custrecord_an_calledby'}),
                            id: originalhistRec.getValue({fieldId:'custrecord_an_txn'}),
                            isDynamic: true });
                        var phaux_response = {code: 200, body : originalhistRec.getValue({fieldId:'custrecord_an_response'})};
                        log.debug('DEBUGGER - prior response to - reparse is:', phaux_response);
                        var historyPaserObj = authNet.historyParseTester(newHistRec, txnRec, phaux_response);
                        log.debug('DEBUGGER - historyPaserObj - reparse is:', historyPaserObj);
                        o_response.OK = historyPaserObj.history.save();
                        o_response.oldResponse = JSON.parse(originalhistRec.getValue({fieldId:'custrecord_an_response'}));
                        break;
                    default:

                    break;
                }
                context.response.write(JSON.stringify(o_response));
            }
        }
        return {
            onRequest: onRequest
        };

    });

var template = "<!DOCTYPE html>\n" +
    "<html lang=\"en\">\n" +
    "<head>\n" +
    "    <meta charset=\"UTF-8\">\n" +
    "    <title>Authorize.net Error</title>\n" +
    "    <style>\n" +
    "body {" +
    "  font-family: Arial, Helvetica, sans-serif;\n" +
    "}\n"+
    "        div.container {\n" +
    "            width: 100%;\n" +
    "            border: 1px solid gray;\n" +
    "        }\n" +
    "\n" +
    "        header, footer {\n" +
    "            padding: 1em;\n" +
    "            color: white;\n" +
    "            background-color: black;\n" +
    "            clear: left;\n" +
    "            text-align: center;\n" +
    "        }\n" +
    "\n" +
    "        nav {\n" +
    "            float: left;\n" +
    "            max-width: 160px;\n" +
    "            margin: 0;\n" +
    "            padding: 1em;\n" +
    "        }\n" +
    "\n" +
    "        nav ul {\n" +
    "            list-style-type: none;\n" +
    "            padding: 0;\n" +
    "        }\n" +
    "\n" +
    "        nav ul a {\n" +
    "            text-decoration: none;\n" +
    "        }\n" +
    "\n" +
    "        article {\n" +
    "            margin-left: 170px;\n" +
    "            border-left: 1px solid gray;\n" +
    "            padding: 1em;\n" +
    "            overflow: hidden;\n" +
    "        }\n" +
    "    </style>\n" +
    "</head>\n" +
    "<body>\n" +
    "\n" +
    "<div class=\"container\">\n" +
    "\n" +
    "    <header>\n" +
    "        <h1>%%CODE%%</h1>\n" +
    "    </header>\n" +
    "    <nav>\n" +
    "        <ul>\n" +
    "            <li><a href=\"javascript:history.back()\">Back to transaction</a></li>\n" +
    "            <li>--</li>\n" +
    "            <li><a href=\"%%LOG%%\">Authorize.Net Log</a></li>\n" +
    "        </ul>\n" +
    "    </nav>\n" +
    "\n" +
    "    <article>\n" +
    "        <h1>%%ERROR%%</h1>\n" +
    "        %%MESSAGES%%\n" +
    "        <p>This error occured using the following card: %%cardData%%</p>\n" +
    "        <p>Authorize.net Transaction %%transHash%%</p>\n" + //https://sandbox.authorize.net/ui/themes/sandbox/transaction/transactiondetail.aspx?transID=60128875331
    "    </article>\n" +
    "\n" +
    "    <footer style='color:red'>This transaction was not saved</footer>\n" +
    "\n" +
    "</div>\n" +
    "\n" +
    "</body>\n" +
    "</html>";