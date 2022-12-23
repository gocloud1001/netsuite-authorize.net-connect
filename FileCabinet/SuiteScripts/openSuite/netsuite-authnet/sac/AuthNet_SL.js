/**
 * @exports XXX
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
                //log.debug('o_config2', o_config2);
                if (o_params.historyId)
                {
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
                            case 'depositapplication':
                            case 'creditmemo':
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
                }
                else if (o_params.csissue)
                {
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
                else if (o_params.fraudAuthApprove)
                {
                    var historyRecord = record.load({
                        type: o_params._type,
                        id: o_params._id,
                        isDynamic : true
                    });
                    //either approve and get the new record or decline and that's that.
                    var txn = record.load({
                        type: historyRecord.getValue({fieldId: 'custrecord_an_calledby'}),
                        id: historyRecord.getValue({fieldId: 'custrecord_an_txn'}),
                        isDynamic : true
                    });
                    var o_parsed = authNet.doFraudApprove(historyRecord, txn, o_params.fraudAuthApprove);
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
                else if (o_params.updatetokenpaymenttype)
                {
                    task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        deploymentId: 'customdeploy_sac_update_profiles_up',
                        scriptId: 'customscript_sac_update_profiles'
                    }).submit();
                    context.response.write('The proces to upgrade your payment tokens to this version is currently runningi n the background.  It will take as long as it takes - based on the number of tokens you have and how fast your instance of NetSuite is based on time of day and system load.  ' +
                        '<p>You WILL NOT be able to enable multi-subsidary functionality until this process has completed.</p>'+
                        '<p>Processing status will be shown on the configuration record</p>'
                    );
                }
                else if (o_params.debugger === 'totallytrue')
                {
                    log.debug('TESTING TOOL PARAMS', o_params);
                    var form = ui.createForm({
                        title: 'CLOUD 1001, LLC Authorize.Net Platform Debugger - USE AT YOUR OWN PERIL!',
                        hideNavBar : false
                    });
                    form.clientScriptModulePath = './AuthNet_unitTests_CL2.js';
                    var rawConfig = form.addField({
                        id: 'custpage_rawconfig',
                        type: ui.FieldType.LONGTEXT,
                        label: 'custpage_rawconfig',
                    }).defaultValue = JSON.stringify(o_config2);
                    var o_subConfig = o_config2;
                    var currentConfig = form.addField({
                        id: 'custpage_currentconfig',
                        type: ui.FieldType.LONGTEXT,
                        label: 'Current Config',
                    }).defaultValue = '{}';
                    //cache management
                    var grp_cache = form.addFieldGroup({
                    id: 'grpcache',
                    label: 'Cache Management'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'Purge the Cache',
                        source: 'purgecache',
                        container: 'grpcache'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'View Current Cache',
                        source: 'viewcache',
                        container: 'grpcache'
                    });

                    //now deal with the subsidiary logic here for all subsequent tests
                    var grp_subs = form.addFieldGroup({
                        id: 'grpsubs',
                        label: 'Configuration Management (Subsidiary / Multi-Gateway)'
                    });
                    var sel_configs;
                    if (o_config2.mode === 'subsidiary')
                    {
                        sel_configs = form.addField({
                            id: 'custpage_configrec',
                            type: ui.FieldType.SELECT,
                            label: 'Subsidiary Gateway To Use',
                            source: 'customrecord_authnet_config_subsidiary',
                            container: 'grpsubs'
                        });
                        sel_configs.isMandatory = true;
                        if (o_params.sub === 'true' && o_params.config)
                        {
                            log.debug('setting the sub config', o_params.config);
                            sel_configs.defaultValue = o_params.config;
                            var o_sub = search.lookupFields({
                                type:'customrecord_authnet_config_subsidiary',
                                id : o_params.config,
                                columns : 'custrecord_ancs_subsidiary'
                            });
                            o_subConfig = o_config2.subs['subid' + o_sub.custrecord_ancs_subsidiary[0].value];
                            currentConfig.defaultValue = JSON.stringify(o_subConfig)
                        }
                        form.addField({
                            id: 'custpage_sub_note',
                            label: 'NOTE : The customer, token and item selected in any test must be accessible to the subsidiary ' +
                                'selected in this gateway.  There is no validation in this tool to ensure that selection or limit ' +
                                'results.  If you make bad choices there will be bad consequences.',
                            type: ui.FieldType.HELP,
                            container: 'grpsubs'
                        });
                    }
                    else
                    {
                        sel_configs = form.addField({
                            id: 'custpage_configrec',
                            type: ui.FieldType.SELECT,
                            label: 'Gateway To Use',
                            source: 'customrecord_authnet_config',
                            container: 'grpsubs'
                        });
                        sel_configs.updateDisplayType({
                            displayType: ui.FieldDisplayType.INLINE
                        });
                        if (o_params.config)
                        {
                            sel_configs.defaultValue = o_params.config;
                        }
                        currentConfig.defaultValue = JSON.stringify(o_config2);
                    }
                    //generic for all tests
                    var generic = form.addFieldGroup({
                        id: 'grpgeneric',
                        label: 'Fields all tests might use'
                    });
                    form.addField({
                        id: 'custpage_guidance',
                        label: 'Here you may select a customer, a token and an item - where it will be used to generate a ' +
                            'test transaction of the type selected using Authorize.Net.  note - if you are in production and have production enabled ' +
                            'the test will attempt to use the production gateway.',
                        type: ui.FieldType.HELP,
                        container: 'grpgeneric'
                    });
                    var customer = form.addField({
                        id: 'customer',
                        type: ui.FieldType.SELECT,
                        source : 'customer',
                        label: 'Customer',
                        container: 'grpgeneric'
                    });
                    var fld_token = form.addField({
                        id: 'token',
                        type: ui.FieldType.SELECT,
                        label: 'CIM Profile / Token',
                        container: 'grpgeneric'
                    });
                    var item = form.addField({
                        id: 'item',
                        type: ui.FieldType.SELECT,
                        source : 'item',
                        label: 'Item',
                        container: 'grpgeneric'
                    });
                    if (o_params.customer)
                    {
                        customer.defaultValue = o_params.customer;
                        //now build the token choices for the customer
                        var a_filters = [
                            ['custrecord_an_token_entity', search.Operator.ANYOF, o_params.customer],
                            "AND",
                            ['custrecord_an_token_pblkchn_tampered', search.Operator.IS, false],
                            "AND",
                            ['isinactive', search.Operator.IS, false],
                            "AND",
                            ['custrecord_an_token_token', 'isnotempty', ''],
                        ];
                        if (o_subConfig.isSubConfig) {
                            a_filters.push("AND");
                            a_filters.push(['custrecord_an_token_gateway', search.Operator.ANYOF, o_subConfig.masterid.toString()]);
                            a_filters.push("AND");
                            a_filters.push(['custrecord_an_token_gateway_sub', search.Operator.ANYOF, o_subConfig.configid.toString()]);
                            a_filters.push("AND");
                            a_filters.push(['custrecord_an_token_subsidiary', search.Operator.ANYOF, o_subConfig.subid.toString()]);
                        } else {
                            a_filters.push("AND");
                            a_filters.push(['custrecord_an_token_gateway', search.Operator.ANYOF, o_subConfig.id.toString()]);
                        }
                        log.debug('token search filters', a_filters);
                        fld_token.addSelectOption({
                            value: '',
                            text: ''
                        });
                        search.create({
                            type: 'customrecord_authnet_tokens',
                            filters: a_filters,
                            columns: [
                                'name',
                                'custrecord_an_token_default'
                            ]
                        }).run().each(function (result) {
                            log.debug('token result', result);
                            fld_token.addSelectOption({
                                value: result.id,
                                text: result.getValue('name') + (result.getValue('custrecord_an_token_default') === true ? ' (Default)' : '')
                            });
                            return true;
                        });
                    }

                    //customer.defaultValue = '1647';
                    /*form.addField({
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
                    items.defaultValue = '[{"item" : "X", "quantity" : "1", "amount": "1.00"}]';
                    var ccnum = form.addField({
                        id: 'ccnum',
                        type: ui.FieldType.TEXT,
                        label: 'Card Number',
                        container: 'grpgeneric'
                    });
                    //ccnum.defaultValue = '4111111111111111';
                    var exp = form.addField({
                        id: 'ccexp',
                        type: ui.FieldType.TEXT,
                        label: 'Card Exp (MMYY)',
                        container: 'grpgeneric'
                    });
                    //exp.defaultValue = '1122';
                    var cvv = form.addField({
                        id: 'ccv',
                        type: ui.FieldType.TEXT,
                        label: 'CCV',
                        container: 'grpgeneric'
                    });
                    //cvv.defaultValue = '111';
                    form.addField({
                        id: 'tokenid',
                        type: ui.FieldType.TEXT,
                        label: 'InternalId of Token Record',
                        container: 'grpgeneric'
                    });*/

                    form.addField({
                        id: 'billzip',
                        type: ui.FieldType.TEXT,
                        label: 'Billing Zip for testing response handling',
                        container: 'grpgeneric'
                    });
                    form.addField({
                        id: 'linejson',
                        type: ui.FieldType.TEXTAREA,
                        label: 'Added JSON Payload (Line)',
                        container: 'grpgeneric'
                    });
                    form.addField({
                        id: 'orderjson',
                        type: ui.FieldType.TEXTAREA,
                        label: 'Added JSON Payload (Body)',
                        container: 'grpgeneric'
                    });


                    //unit testing
                    var grp_authin = form.addFieldGroup({
                        id: 'grpunit',
                        label: 'Some Unit Testing'
                    });
                    /*form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'AUTH.useFakeOrderBodyJSON()',
                        source: 'fakeauthso',
                        container: 'grpunit'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'AUTHCAP.useFakeOrderBodyJSON()',
                        source: 'fakeauthcapso',
                        container: 'grpunit'
                    });*/

                    //auth - UI
                    var grp_authin = form.addFieldGroup({
                        id: 'grpauthin',
                        label: 'Test Auth (Builds SO)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'makeSO().getAuth()',
                        source: 'makeso',
                        container: 'grpauthin'
                    });

                    //capture off so
                    var grp_capture = form.addFieldGroup({
                        id: 'grpcapture',
                        label: 'Test Capture Off SO (Builds SO --> CS)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'makeSO() then makeCashSale().priorAuthCapture()',
                        source: 'captureoffso',
                        container: 'grpcapture'
                    });
                    /*form.addField({
                        id: 'sotocsid',
                        type: ui.FieldType.TEXT,
                        label: 'SO Internal ID to capture!',
                        container: 'grpcapture'
                    });*/

                    //deposit capture
                    var grp_depositcapture = form.addFieldGroup({
                        id: 'grpdepositcapture',
                        label: 'Make SO and Customer Deposit (SO --> Customer Deposit)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'makeSO() then makeDeposit().authCapture()',
                        source: 'makedeposit',
                        container: 'grpdepositcapture'
                    });

                    //direct capture
                    var grp_directcapture = form.addFieldGroup({
                        id: 'grpdircapture',
                        label: 'Test Auth + Capture (Builds standalone CS)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'makeCashSale().authCapture()',
                        source: 'makecs',
                        container: 'grpdircapture'
                    });

                    var grp_custpayment = form.addFieldGroup({
                        id: 'grppaymentcapture',
                        label: 'Make Invoice and Customer Payment (INV --> Customer Payment)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'makeInvoice() then makePayment().authCapture()',
                        source: 'makepayment',
                        container: 'grppaymentcapture'
                    });

                    form.addField({
                        id: 'custpage_numpmt',
                        type: ui.FieldType.INTEGER,
                        label: 'Number of Payments to generate for invoice',
                        container: 'grppaymentcapture'
                    }).defaultValue = 1;

                    var grp_cashrefund = form.addFieldGroup({
                        id: 'grpcashrefund',
                        label: 'Issue Cash Refund (Refunds Cash Sale)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'issueCashRefund()',
                        source: 'cashrefund',
                        container: 'grpcashrefund'
                    });

                    var fld_csToRefund = form.addField({
                        id: 'custpage_cstorefund',
                        type: ui.FieldType.SELECT,
                        label: 'Cash Sale To Refund',
                        container: 'grpcashrefund'
                    });
                    if (o_params.customer)
                    {

                        fld_csToRefund.addSelectOption({
                            value: '',
                            text: ''
                        });
                        search.create({
                            type: 'cashsale',
                            filters: [
                                ['mainline', search.Operator.IS, true],
                                "AND",
                                ['custbody_authnet_use', search.Operator.IS, true],
                                "AND",
                                ['custbody_authnet_refid', search.Operator.ISNOTEMPTY,''],
                                "AND",
                                ['entity', search.Operator.ANYOF, o_params.customer],
                                "AND",
                                ['status', search.Operator.ANYOF, ["CashSale:B", "CashSale:C"]],
                            ],
                            columns: [
                                'tranid',
                                'amount',
                                'applyingtransaction'
                            ]
                        }).run().each(function (result) {
                            //log.debug('cashsale result', result);
                            if (!result.getValue('applyingtransaction')) {
                                //we dont want any that may have been refunded already to mess with - this is a unit test, remember
                                fld_csToRefund.addSelectOption({
                                    value: result.id,
                                    text: '#' + result.getValue('tranid') + ' ($' + result.getValue('amount') + ')'
                                });
                            }
                            return true;
                        });
                    }

                    //Issue customer refund off deposit
                    form.addFieldGroup({
                        id: 'custref_deposit',
                        label: 'Issue Customer Refund (Refund Deposit)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'issueRefund()',
                        source: 'custref_deposit',
                        container: 'custref_deposit'
                    });


                    if (o_params.customer)
                    {
                        var fld_depTxnToRefund = form.addField({
                            id: 'custpage_deptxntorefund',
                            type: ui.FieldType.SELECT,
                            label: 'Deposit to Refund',
                            container: 'custref_deposit'
                        });

                        fld_depTxnToRefund.addSelectOption({
                            value: '',
                            text: ''
                        });
                        search.create({
                            type: 'transaction',
                            filters: [
                                [
                                    [
                                        ['type', search.Operator.ANYOF, ['CustDep']],
                                        "AND",
                                        ['status', search.Operator.NONEOF, ["CustDep:C"]]
                                    ],
                                ],
                                "AND",
                                ['mainline', search.Operator.IS, true],
                                "AND",
                                ['custbody_authnet_use', search.Operator.IS, true],
                                "AND",
                                ['custbody_authnet_refid', search.Operator.ISNOTEMPTY,''],
                                "AND",
                                ['entity', search.Operator.ANYOF, o_params.customer],
                            ],
                            columns: [
                                'tranid',
                                'amount',
                                'type',
                                'applyingtransaction',
                                'appliedtotransaction'
                            ]
                        }).run().each(function (result) {
                            log.debug('deposit pick list result', result);
                            if (!result.getValue('applyingtransaction')) {
                                //we dont want any that may have been refunded already to mess with - this is a unit test, remember
                                fld_depTxnToRefund.addSelectOption({
                                    value: result.id,
                                    text: result.getText('type') + ' #' + result.getValue('tranid') + ' ($' + result.getValue('amount') + ')'
                                });
                            }
                            return true;
                        });
                    }
                    
                    //issue custoemr refund off invoice via credit memo
                    form.addFieldGroup({
                        id: 'custref_inv_cm',
                        label: 'Issue Customer Refund (Refund Credit Memo Off Invoice)'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'issueCustomerRefund()',
                        source: 'custref_inv_cm',
                        container: 'custref_inv_cm'
                    });


                    if (o_params.customer)
                    {
                        var fld_txnToRefund = form.addField({
                            id: 'custpage_invtxntorefund',
                            type: ui.FieldType.SELECT,
                            label: 'Invoice to Issue Credit Memo and Refund',
                            container: 'custref_inv_cm'
                        });

                        fld_txnToRefund.addSelectOption({
                            value: '',
                            text: ''
                        });
                        var o_invoicesToProcess = {};
                        search.create({
                            type: 'invoice',
                            filters: [
                                ['status', search.Operator.ANYOF, ["CustInvc:B"]],
                                "AND",
                                ['mainline', search.Operator.IS, true],
                                "AND",
                                ['entity', search.Operator.ANYOF, o_params.customer],
                                "AND",
                                ['applyingtransaction', search.Operator.NONEOF, ['@NONE@']],
                            ],
                            columns: [
                                'tranid',
                                'amount',
                                'type',
                                'applyingtransaction',
                                {name : 'type', join : 'applyingtransaction'}
                            ]
                        }).run().each(function (result) {
                            log.debug('invoice pick list result', result);
                            if (o_invoicesToProcess[result.getValue('tranid')])
                            {
                                if (!result.getValue({name : 'type', join : 'applyingtransaction'}) === 'CustPymt')
                                {
                                    o_invoicesToProcess[result.getValue('tranid')].isRefundable = false;
                                }
                            }
                            else
                            {
                                o_invoicesToProcess[result.getValue('tranid')] = {
                                    id : result.id,
                                    tranid : result.getValue('tranid'),
                                    amount : result.getValue('amount'),
                                    type : result.getText('type'),
                                    applyingtransaction : result.getValue('applyingtransaction'),
                                    isRefundable : result.getValue({name : 'type', join : 'applyingtransaction'}) === 'CustPymt'
                                }
                            }
                            return true;
                        });
                        _.forEach(o_invoicesToProcess, function (inv){
                            if (inv.isRefundable)
                            {
                                fld_txnToRefund.addSelectOption({
                                    value: inv.id,
                                    text: inv.type + ' #' + inv.tranid + ' ($' + inv.amount + ')'
                                });
                            }

                        });
                    }

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
                        label: 'authnet tranid (if your settings are to create a deposit with the SO, this must be an authCapture)',
                        container: 'grpauthout'
                    });
                    form.addField({
                        id: 'externalorderid',
                        type: ui.FieldType.TEXT,
                        label: 'External Order ID (this will go in the configured fieldid to trigger external auth)',
                        container: 'grpauthout'
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

                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'getBy-NSeId()',
                        source: 'cimbynseid',
                        container: 'grpcim'
                    });
                    form.addField({
                        id: 'custpage_test',
                        type: ui.FieldType.RADIO,
                        label: 'getBy-ProfileId()',
                        source: 'cimbyprofileid',
                        container: 'grpcim'
                    });
                    form.addField({
                        id: 'nseid',
                        type: ui.FieldType.TEXT,
                        label: 'merchantCustomerId',
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
                    try {
                        redirect.toRecord({
                            type: 'customrecord_authnet_config',
                            id: o_config2.id,
                            isEditMode: !o_config2.custrecord_an_enable.val,
                            parameters: {'custparam_issetup': 'true'}
                        });
                    }
                    catch(ex)
                    {
                        log.emergency(ex.name, ex.message);
                        log.emergency(ex.name, ex.stack);
                        redirect.toRecord({
                            type: 'customrecord_authnet_config',
                            id: o_config2.id,
                            parameters: {'custparam_issetup': 'true'}
                        });
                    }
                }

                }

            } else {
                log.debug('POST');
                log.debug('context.request.parameters', context.request.parameters);
                var o_params = context.request.parameters;
                var o_config2 = authNet.getConfigFromCache();
                var o_response = {'OK':null, reset : '<a href=' + url.resolveScript({
                        scriptId: 'customscript_c9_authnet_screen_svc',
                        deploymentId: 'customdeploy_sac_authnet_screen_svc',
                        params: {debugger : 'totallytrue'}
                    })+ '>Run another test</a>'};
                function buildSO(o_params, o_response)
                {
                    var testSo = record.create({
                        type: 'salesorder',
                        isDynamic : true
                    });
                    testSo.setValue({fieldId: 'entity', value : o_params.customer });
                    testSo.setValue({fieldId: 'memo', value: 'AuthNet Unit Test'});
                    testSo.selectNewLine({sublistId:'item'});
                    testSo.setCurrentSublistValue({sublistId:'item', fieldId:'item', value:o_params.item});
                    testSo.setCurrentSublistValue({sublistId:'item', fieldId:'quantity', value:1});
                    testSo.setCurrentSublistValue({sublistId:'item', fieldId:'price', value : -1});
                    testSo.setCurrentSublistValue({sublistId:'item', fieldId:'amount', value:'1.'+moment().format('DD')});
                    try {
                        if (o_params.linejson)
                        {
                            _.forEach(JSON.parse(o_params.linejson), function(val, kie) {
                                log.debug(kie, val)
                                testInv.setCurrentSublistValue({sublistId:'item', fieldId:kie, value : val});
                            });
                        }

                    } catch (e){
                        o_response.bodyJSONError = e.name +' : '+ e.message;
                        log.error('Line JSON Error', o_response.bodyJSONError);
                    }
                    testSo.commitLine({sublistId:'item'});
                    var addressSubRec = testSo.getSubrecord({fieldId: 'billingaddress' });
                    addressSubRec.setValue({fieldId: 'country', value: 'US'});
                    var o_address = {
                        'zip':o_params.billzip ? o_params.billzip : 14568,
                        'state':'NY',
                        'city': 'Walworth',
                        'addrphone': '555-867-5309',
                        'addr1' : '123 Main Street',
                        'addr2' : 'Appt. B',
                        'attention' : 'AuthNet Tester!',
                        'addressee' : 'Mr. Person'
                    };
                    _.forEach(o_address, function(val, kie){
                        addressSubRec.setValue({fieldId: kie, value: val});
                    });

                    testSo.setValue({fieldId:'billaddressee', value: o_address.addressee });
                    testSo.setValue({fieldId:'billcountry', value: 'US' });
                    testSo.setValue({fieldId:'billzip', value: o_address.zip  });
                    testSo.setValue({fieldId:'billstate', value: o_address.state  });
                    testSo.setValue({fieldId:'billcity', value: o_address.city  });
                    testSo.setValue({fieldId:'billaddr1', value: o_address.addr1  });
                    testSo.setValue({fieldId:'billaddr2', value: o_address.addr2  });
                    testSo.setValue({fieldId:'billphone', value: o_address.addrphone  });
                    testSo.setValue({fieldId: 'orderstatus', value : 'B' });
                    if (!o_params.skipAuth) {
                        testSo.setValue({fieldId: 'custbody_authnet_use', value: true});
                        testSo.setValue({fieldId: 'custbody_authnet_cim_token', value: +o_params.token});
                        testSo.setValue({fieldId: 'paymentmethod', value : o_config2.custrecord_an_paymentmethod.val });;
                    }
                    else if(o_params.custpage_test ==='makeextso') {
                        testSo.setValue({fieldId: 'custbody_authnet_use', value: true});
                        testSo.setValue({fieldId: 'custbody_authnet_refid', value: o_params.refid});
                        testSo.setValue({fieldId: 'paymentmethod', value : o_config2.custrecord_an_paymentmethod.val });
                        //todo - get config here to ensure the correct behavior
                        testSo.setValue({
                            fieldId: o_config2.custrecord_an_external_fieldid.val,
                            value: o_params.externalorderid
                        });
                    }
                    try {
                        if (o_params.orderjson)
                        {
                            _.forEach(JSON.parse(o_params.orderjson), function(val, kie) {
                                testSo.setValue({fieldId:kie, value: val  });
                            });
                        }
                    } catch (e){
                        o_response.bodyJSONError = e.name +' : '+ e.message;
                    }
                    var i_soId = testSo.save({ignoreMandatoryFields:true});
                    o_response.OK = true;
                    o_response.soid = i_soId;
                    var _recordlink = url.resolveRecord({
                        recordType: 'salesorder',
                        recordId: i_soId,
                        //isEditMode: true
                    });
                    if (!o_params.skipAuth) {
                        o_response.link = '<a target="_blank" href=' + _recordlink + '>New Sales Order (auth)</a>';
                    }
                    else
                    {
                        o_response.link = '<a target="_blank" href=' + _recordlink + '>New Sales Order</a>';
                    }
                    return o_response;
                }
                function buildCS(o_params, o_response)
                {
                    var testCS = record.create({
                        type: 'cashsale',
                        isDynamic : true
                    });
                    testCS.setValue({fieldId: 'entity', value : o_params.customer });
                    testCS.setValue({fieldId: 'memo', value: 'AuthNet Unit Test'});
                    testCS.selectNewLine({sublistId:'item'});
                    testCS.setCurrentSublistValue({sublistId:'item', fieldId:'item', value:o_params.item});
                    testCS.setCurrentSublistValue({sublistId:'item', fieldId:'quantity', value:1});
                    testCS.setCurrentSublistValue({sublistId:'item', fieldId:'price', value : -1});
                    testCS.setCurrentSublistValue({sublistId:'item', fieldId:'amount', value:'1.'+moment().format('DD')});
                    try {
                        if (o_params.linejson)
                        {
                            _.forEach(JSON.parse(o_params.linejson), function(val, kie) {
                                log.debug(kie, val)
                                testInv.setCurrentSublistValue({sublistId:'item', fieldId:kie, value : val});
                            });
                        }

                    } catch (e){
                        o_response.bodyJSONError = e.name +' : '+ e.message;
                        log.error('Line JSON Error', o_response.bodyJSONError);
                    }
                    testCS.commitLine({sublistId:'item'});
                    var addressSubRec = testCS.getSubrecord({fieldId: 'billingaddress' });
                    addressSubRec.setValue({fieldId: 'country', value: 'US'});
                    var o_address = {
                        'zip':o_params.billzip ? o_params.billzip : 14568,
                        'state':'NY',
                        'city': 'Walworth',
                        'addrphone': '555-867-5309',
                        'addr1' : '123 Main Street',
                        'addr2' : 'Appt. B',
                        'attention' : 'AuthNet Tester!',
                        'addressee' : 'Mr. Person'
                    };
                    _.forEach(o_address, function(val, kie){
                        addressSubRec.setValue({fieldId: kie, value: val});
                    });

                    testCS.setValue({fieldId:'billaddressee', value: o_address.addressee });
                    testCS.setValue({fieldId:'billcountry', value: 'US' });
                    testCS.setValue({fieldId:'billzip', value: o_address.zip  });
                    testCS.setValue({fieldId:'billstate', value: o_address.state  });
                    testCS.setValue({fieldId:'billcity', value: o_address.city  });
                    testCS.setValue({fieldId:'billaddr1', value: o_address.addr1  });
                    testCS.setValue({fieldId:'billaddr2', value: o_address.addr2  });
                    testCS.setValue({fieldId:'billphone', value: o_address.addrphone  });
                    testCS.setValue({fieldId: 'custbody_authnet_use', value : true });
                    testCS.setValue({fieldId: 'orderstatus', value : 'B' });
                    testCS.setValue({fieldId: 'custbody_authnet_cim_token', value : +o_params.token});
                    testCS.setValue({fieldId: 'paymentmethod', value : o_config2.custrecord_an_paymentmethod.val });
                    try {
                        if (o_params.orderjson)
                        {
                            _.forEach(JSON.parse(o_params.orderjson), function(val, kie) {
                                testCS.setValue({fieldId:kie, value: val  });
                            });
                        }
                    } catch (e){
                        o_response.bodyJSONError = e.name +' : '+ e.message;
                    }
                    var i_csId = testCS.save({ignoreMandatoryFields:true});
                    o_response.OK = true;
                    o_response.csid = i_csId;
                    var _recordlink = url.resolveRecord({
                        recordType: 'cashsale',
                        recordId: i_csId,
                        //isEditMode: true
                    });
                    o_response.link = '<a target="_blank" href=' + _recordlink + '>New Cash Sale (authCapture)</a>';
                    return o_response;
                }
                function buildINV(o_params, o_response)
                {
                    var testInv = record.create({
                        type: 'invoice',
                        isDynamic : true
                    });
                    testInv.setValue({fieldId: 'entity', value : o_params.customer });
                    testInv.setValue({fieldId: 'memo', value: 'AuthNet Unit Test'});;
                    testInv.selectNewLine({sublistId:'item'});
                    testInv.setCurrentSublistValue({sublistId:'item', fieldId:'item', value:o_params.item});
                    testInv.setCurrentSublistValue({sublistId:'item', fieldId:'quantity', value:1});
                    testInv.setCurrentSublistValue({sublistId:'item', fieldId:'price', value : -1});
                    testInv.setCurrentSublistValue({sublistId:'item', fieldId:'amount', value:+('1.'+moment().format('DD')) * +o_params.custpage_numpmt});
                    try {
                        if (o_params.linejson)
                        {
                            _.forEach(JSON.parse(o_params.linejson), function(val, kie) {
                                log.debug(kie, val)
                                testInv.setCurrentSublistValue({sublistId:'item', fieldId:kie, value : val});
                            });
                        }

                    } catch (e){
                        o_response.bodyJSONError = e.name +' : '+ e.message;
                        log.error('Line JSON Error', o_response.bodyJSONError);
                    }

                    testInv.commitLine({sublistId:'item'});
                    var addressSubRec = testInv.getSubrecord({fieldId: 'billingaddress' });
                    addressSubRec.setValue({fieldId: 'country', value: 'US'});
                    var o_address = {
                        'zip':o_params.billzip ? o_params.billzip : 14568,
                        'state':'NY',
                        'city': 'Walworth',
                        'addrphone': '555-867-5309',
                        'addr1' : '123 Main Street',
                        'addr2' : 'Appt. B',
                        'attention' : 'AuthNet Tester!',
                        'addressee' : 'Mr. Person'
                    };
                    _.forEach(o_address, function(val, kie){
                        addressSubRec.setValue({fieldId: kie, value: val});
                    });

                    testInv.setValue({fieldId:'billaddressee', value: o_address.addressee });
                    testInv.setValue({fieldId:'billcountry', value: 'US' });
                    testInv.setValue({fieldId:'billzip', value: o_address.zip  });
                    testInv.setValue({fieldId:'billstate', value: o_address.state  });
                    testInv.setValue({fieldId:'billcity', value: o_address.city  });
                    testInv.setValue({fieldId:'billaddr1', value: o_address.addr1  });
                    testInv.setValue({fieldId:'billaddr2', value: o_address.addr2  });
                    testInv.setValue({fieldId:'billphone', value: o_address.addrphone  });

                    try {
                        if (o_params.orderjson)
                        {
                            _.forEach(JSON.parse(o_params.orderjson), function(val, kie) {
                                testInv.setValue({fieldId:kie, value: val  });
                            });
                        }
                    } catch (e){
                        o_response.bodyJSONError = e.name +' : '+ e.message;
                    }
                    var i_inId = testInv.save({ignoreMandatoryFields:true});
                    o_response.OK = true;
                    o_response.inid = i_inId;
                    var _recordlink = url.resolveRecord({
                        recordType: 'invoice',
                        recordId: i_inId,
                        //isEditMode: true
                    });
                    o_response.invlink = '<a target="_blank" href=' + _recordlink + '>New Invoice</a>';
                    return o_response;
                }
                function buildCustomerRefund(o_params, o_response, i_idToRefund)
                {
                    var o_custRefnd = record.create({
                        type : 'customerrefund',
                        defaultValues : {entity : o_params.customer}
                        //isDynamic : true
                    });
                    for(var i = o_custRefnd.getLineCount('apply')-1; i>= 0; i--){
                        log.debug('apply line '+i, o_custRefnd.getSublistValue({sublistId: 'apply' , fieldId: 'doc', line:i}));
                        if (+o_custRefnd.getSublistValue({sublistId: 'apply' , fieldId: 'doc', line:i}) === i_idToRefund){
                            o_custRefnd.setSublistValue({sublistId: 'apply' , fieldId: 'apply', line:i, value : true});
                        }
                        else {
                            o_custRefnd.setSublistValue({sublistId: 'apply', fieldId: 'apply', line: i, value: false});
                        }
                    }
                    for(var i = o_custRefnd.getLineCount('deposit')-1; i>= 0; i--) {
                        log.debug('deposit line '+i, o_custRefnd.getSublistValue({sublistId: 'deposit' , fieldId: 'doc', line:i}));
                        if (+o_custRefnd.getSublistValue({
                            sublistId: 'deposit',
                            fieldId: 'doc',
                            line: i
                        }) === i_idToRefund) {
                            o_custRefnd.setSublistValue({sublistId: 'deposit', fieldId: 'apply', line: i, value: true});
                        } else {
                            o_custRefnd.setSublistValue({sublistId: 'deposit', fieldId: 'apply', line: i, value: false});
                        }
                    }
                    o_custRefnd.setValue({fieldId: 'memo', value: 'AuthNet Unit Test'});
                    o_custRefnd.setValue({fieldId: 'custbody_authnet_use', value : true });
                    o_custRefnd.setValue({fieldId: 'paymentmethod', value : o_config2.custrecord_an_paymentmethod.val });
                    var i_crId = o_custRefnd.save({ignoreMandatoryFields:true});
                    o_response.customerRefundid = i_crId;
                    var _recordlink = url.resolveRecord({
                        recordType: 'customerrefund',
                        recordId: i_crId,
                        //isEditMode: true
                    });
                    o_response.refundlink = '<a target="_blank" href=' + _recordlink + '>New Customer Refund (refundTransaction)</a>';
                    return o_response;
                }

                switch (o_params.custpage_test){
                    case 'purgecache':
                        authNet.purgeCache();
                        o_response.OK = true;
                        o_response.message = 'Cache Purged';
                        break;
                    case 'viewcache':
                        o_response.OK = true;
                        o_response.cache = authNet.getConfigFromCache()
                        //context.response.write(JSON.stringify(authNet.getConfigFromCache()));
                        break;
                    case 'fakeauthcapso':
                        o_response.OK = true;
                        o_response.responseFrom_getStatusCheck = authNet.getStatusCheck(o_params.custpage_tranrefid);
                        break;

                    case 'getstatus':
                        o_response.OK = true;
                        if (o_params.custpage_configrec)
                        {
                            o_response.responseFrom_getStatusCheck = authNet.getStatusCheck(o_params.custpage_tranrefid, o_params.custpage_configrec);
                        }
                        else
                        {
                            o_response.responseFrom_getStatusCheck = authNet.getStatusCheck(o_params.custpage_tranrefid);
                        }

                        break;

                    case 'makeso':
                        //make the so and set all the fields and save...
                        o_response = buildSO(o_params, o_response);
                        break;
                    case 'captureoffso':
                        o_response = buildSO(o_params, o_response)
                        var o_customerBill = record.transform({
                            fromType: 'salesorder',
                            fromId: o_response.soid,
                            toType: 'cashsale',
                            isDynamic: true
                        });
                        var i_csId = o_customerBill.save({ignoreMandatoryFields:true});
                        o_response.csid = i_csId;
                        var _recordlink = url.resolveRecord({
                            recordType: 'cashsale',
                            recordId: i_csId,
                            //isEditMode: true
                        });
                        o_response.link2 = '<a target="_blank" href=' + _recordlink + '>New Cash Sale (capture off prior auth)</a>';

                        break;
                    case 'makecs':
                        o_response = buildCS(o_params, o_response);
                        break;
                    case 'makedeposit':
                        o_params.skipAuth = true;
                        o_response = buildSO(o_params, o_response);
                        var o_customerDeposit = record.create({
                            type: 'customerdeposit',
                            disablepaymentfilters: true,
                            isDynamic: true
                        });
                        o_customerDeposit.setValue({fieldId: 'customer', value:  o_params.customer});
                        o_customerDeposit.setValue({fieldId: 'salesorder', value:  o_response.soid});
                        o_customerDeposit.setValue({fieldId: 'memo', value: 'AuthNet Unit Test'});
                        //o_customerDeposit.setValue({fieldId:'payment', value: +testSo.getValue({fieldId: 'total'}) / 2 });
                        o_customerDeposit.setValue({fieldId: 'custbody_authnet_use', value : true });
                        o_customerDeposit.setValue({fieldId: 'paymentmethod', value : o_config2.custrecord_an_paymentmethod.val });
                        o_customerDeposit.setValue({fieldId: 'undepfunds', value : 'T' });
                        //o_customerDeposit.setValue({fieldId: 'account', value : 186 });
                        o_customerDeposit.setValue({fieldId: 'custbody_authnet_cim_token', value : +o_params.token });
                        var i_cdId = o_customerDeposit.save({ignoreMandatoryFields:true});
                        o_response.cdid = i_cdId;
                        var _recordlink = url.resolveRecord({
                            recordType: 'customerdeposit',
                            recordId: i_cdId,
                            //isEditMode: true
                        });
                        o_response.link2 = '<a target="_blank" href=' + _recordlink + '>New Customer Deposit (authCapture)</a>';
                        break;
                    case 'makepayment':
                        o_params.skipAuth = true;
                        o_response = buildINV(o_params, o_response);
                        var numPayments = 0;
                        while (numPayments < +o_params.custpage_numpmt) {
                            numPayments++;
                            var o_custPayment = record.transform({
                                fromType: 'invoice',
                                fromId: o_response.inid,
                                toType: 'customerpayment'
                            });
                            o_custPayment.setValue({fieldId: 'memo', value: 'AuthNet Unit Test'});
                            o_custPayment.setValue({fieldId: 'custbody_authnet_use', value: true});
                            o_custPayment.setValue({fieldId: 'custbody_authnet_cim_token', value: +o_params.token});
                            o_custPayment.setValue({
                                fieldId: 'paymentmethod',
                                value: o_config2.custrecord_an_paymentmethod.val
                            });
                            var i_numLines = +o_custPayment.getLineCount('apply');
                            //log.debug('if line count', i_numLines);
                            var b_canSave = false;
                            for (var j = 0; j < i_numLines; j++) {
                                if (+o_custPayment.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'internalid',
                                    line: j
                                }) === o_response.inid) {
                                    o_custPayment.setSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'apply',
                                        line: j,
                                        value: true
                                    });
                                    o_custPayment.setSublistValue({sublistId:'apply', fieldId:'amount', line: j, value: ('1.'+moment().format('DD'))});
                                    b_canSave = true;
                                } else {
                                    o_custPayment.setSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'apply',
                                        line: j,
                                        value: false
                                    });
                                }
                            }
                            if (b_canSave) {
                                var i_paymentId = o_custPayment.save({ignoreMandatoryFields: true});
                                o_response.custpayid = i_paymentId;
                                var _recordlink = url.resolveRecord({
                                    recordType: 'customerpayment',
                                    recordId: i_paymentId,
                                    //isEditMode: true
                                });
                                o_response['link'+numPayments] = '<a target="_blank" href=' + _recordlink + '>New Customer Payment (authCapture)</a>';
                            } else {
                                o_response.paymentMessage = 'ALREADY PAID IN FULL!'
                            }

                        }
                        
                        break;
                    case 'cashrefund':
                        var o_cashRefund = record.transform({
                            fromType: 'cashsale',
                            fromId: o_params.custpage_cstorefund,
                            toType: 'cashrefund'
                        });
                        var i_cashRefundId = o_cashRefund.save({ignoreMandatoryFields:true});

                        var _recordlink = url.resolveRecord({
                            recordType: 'cashsale',
                            recordId: o_params.custpage_cstorefund,
                            //isEditMode: true
                        });
                        o_response.link = '<a target="_blank" href=' + _recordlink + '>Old Cash Sale</a>';

                        o_response.cashrefundid = i_cashRefundId;
                        var _recordlink = url.resolveRecord({
                            recordType: 'cashrefund',
                            recordId: i_cashRefundId,
                            //isEditMode: true
                        });
                        o_response.link2 = '<a target="_blank" href=' + _recordlink + '>New Cash Refund (refundTransaction)</a>';

                        break;
                    case 'custref_deposit':
                        log.debug('o_params.custpage_deptxntorefund', o_params.custpage_deptxntorefund);
                        o_response = buildCustomerRefund(o_params, o_response, +o_params.custpage_deptxntorefund);
                        break;

                    case 'custref_inv_cm':
                        //first we need to build a credit memo off the invoice
                        var o_creditMemo = record.transform({
                            fromType: 'invoice',
                            fromId: o_params.custpage_invtxntorefund,
                            toType: 'creditmemo',
                            isDynamic: true
                        });
                        var i_cmId = o_creditMemo.save({ignoreMandatoryFields:true});
                        o_response.cmid = i_cmId;
                        var _recordlink = url.resolveRecord({
                            recordType: 'creditmemo',
                            recordId: i_cmId,
                            //isEditMode: true
                        });
                        o_response.cmlink = '<a target="_blank" href=' + _recordlink + '>New Credit Memo From Invoice</a>';
                        //now we customer refund the credit memo
                        o_response = buildCustomerRefund(o_params, o_response, +o_response.cmid);
                        break;
                    case 'makeextso':
                        o_params.skipAuth = true;
                        o_response = buildSO(o_params, o_response);
                        break;
                    case 'cim':
                        var thisRec=record.load({
                            type : o_params.txntype,
                            id: o_params.txnid,
                            isDynamic: true });
                        //var o_config = authNet.getActiveConfig(thisRec);
                        o_response = authNet.getCIM(thisRec, o_config2);
                        break;
                    case 'cimbynseid':
                        log.debug('DEBUGGER - testing CIM lookiups', o_params.nseid);
                        authNet.getProfileByNSeId(o_params.nseid, o_config2);
                        break;
                    case 'cimbyprofileid':
                        log.debug('DEBUGGER - testing CIM lookiups by profile id', o_params.nseid);
                        var o_profile_JSON = {fields: {custrecord_an_token_customerid : o_params.nseid, custrecord_an_token_gateway_sub : o_params.custpage_configrec}};
                        o_response.OK = true;
                        o_response.cim = authNet.importCIMToken(o_profile_JSON);
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
    "        header {\n" +
    "            padding: 1em;\n" +
    "            color: white;\n" +
    "            background-color: #9b0000;\n" +
    "            clear: left;\n" +
    "            text-align: center;\n" +
    "        }\n" +
    "\n" +
    "        footer {\n" +
    "            padding: 1em;\n" +
    "            color: white;\n" +
    "            background-color: #480000;\n" +
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