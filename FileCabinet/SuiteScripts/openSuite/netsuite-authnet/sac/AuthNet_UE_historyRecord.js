/**
 * Module Description...
 *
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
 * @NScriptType UserEventScript
 *
 * @NAmdConfig ../config.json
 */


define(['N/record', 'N/encode', 'N/runtime', 'N/cache', 'N/ui/message', 'N/error', 'lodash', './AuthNet_lib'],
    function (record, encode, runtime, cache, message, error, _, authNet) {


        function beforeLoad(context) {
            //when loading validate the hash and throw an alert if it's invalid
            authNet.homeSysLog('beforeLoad', context.type);
            if (runtime.executionContext === 'USERINTERFACE' ) {
                if (context.type !== 'create') {
                    var form = context.form;
                    form.clientScriptModulePath = './AuthNet_CL_historyRecord.js';
                    if (context.newRecord.getValue({fieldId: 'custrecord_an_response_status'}) === 'Ok')
                    {
                        if (context.newRecord.getValue({fieldId: 'custrecord_an_call_type'}) === 'authOnlyTransaction') {
                            //lets see if this auth has been used
                            var o_status = authNet.getStatusCheck(context.newRecord.getValue({fieldId: 'custrecord_an_refid'}));
                            log.debug('o_status', o_status)
                            authNet.homeSysLog('authNet.getStatusCheck() -> o_status', o_status);
                            if (o_status.transactionStatus === 'authorizedPendingCapture') {
                                form.addButton({
                                    id: 'custpage_voidauth',
                                    label: 'Void Authorization',
                                    functionName: 'setAuthVoid' //set it to P
                                });
                            }
                        } else if (context.newRecord.getValue({fieldId: 'custrecord_an_call_type'}) === 'createCustomerProfileFromTransactionRequest'){

                            form.addButton({
                                id: 'custpage_redocim',
                                label: 'Request Token',
                                functionName: 'getCIM' //set it to P
                            });

                        }
                    }
                    else if (+context.newRecord.getValue({fieldId: 'custrecord_an_response_code'}) === 4)
                    {
                        var o_heldStatus = authNet.getStatusCheck(context.newRecord.getValue({fieldId: 'custrecord_an_refid'}));
                        log.debug('o_heldStatus', o_heldStatus);

                        if (o_heldStatus.fullResponse.FDSFilterAction)
                        {
                            var s_message = '<ul>';
                            s_message += '<li style="list-style-type: circle;">AVS Message: '+context.newRecord.getValue({fieldId: 'custrecord_an_avs_status'})+'</li>';
                            if (context.newRecord.getValue({fieldId: 'custrecord_an_cvvresultcode'}) !== 'M')
                            {
                                s_message += '<li style="list-style-type: circle;">CCV Message: '+context.newRecord.getValue({fieldId: 'custrecord_an_cvv_status'})+'</li>';
                            }
                            s_message += '</ul>';
                            s_message += 'You may want to review this transaction in Authorize.Net, you can also make the decision here to approve or reject this transaction. <br/>' +
                                'If the buttons are not present - the transaction has already been resolved.'
                            form.addPageInitMessage({
                                type: message.Type.WARNING,
                                title: 'This '+context.newRecord.getValue({fieldId: 'custrecord_an_call_type'}) + ' has been Held For Review ',
                                message: s_message,
                            });
                            form.addButton({
                                id: 'custpage_approveauth',
                                label: 'Approve Authorization',
                                functionName: 'doApprove'
                            });
                            form.addButton({
                                id: 'custpage_declineauth',
                                label: 'Decline Authorization',
                                functionName: 'doDecline'
                            });

                        }
                    }
                }
            }




        }
        function beforeSubmit(context) {
            //when context.type === create, hash things and add to the transaction so it matches
            //if the runtime is not suitelet - throw an exception
            authNet.homeSysLog('beforeSubmit', context.type);
            if (context.type === 'edit'){
                if (context.newRecord.getValue({fieldId : 'custrecord_an_txn'}) !== context.oldRecord.getValue({fieldId : 'custrecord_an_txn'})){
                    if (context.newRecord.getValue({fieldId : 'custrecord_an_response_status'}) === 'Error'){
                    //if (context.newRecord.getValue({fieldId : 'custbody_authnet_authcode'}) && context.newRecord.getValue({fieldId : 'custbody_authnet_refid'})){
                        try {
                            record.submitFields({
                                type: context.newRecord.getValue({fieldId: 'custrecord_an_calledby'}),
                                id: context.oldRecord.getValue({fieldId: 'custrecord_an_txn'}),
                                values: {
                                    'custbody_authnet_error_status': ''//,
                                    //'custbody_authnet_use': true
                                }
                            });
                        } catch (e){
                            log.error('Update of SO failed')
                        }
                    } else {
                        throw 'Unable to REMOVE a valid authorize.net call from this transaction.'
                    }
                }
            }
        }
        function afterSubmit(context) {
            //on a remove event - can we update the SO to undo whatever this record did
            authNet.homeSysLog('afterSubmit', context.type);
        }
        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });