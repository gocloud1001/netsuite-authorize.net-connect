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
define(['N/record', 'N/search','N/encode', 'N/log', 'N/file', 'N/format', 'N/task', 'N/runtime', 'N/ui/serverWidget', 'N/url', 'moment', 'lodash', './AuthNet_lib'],
    function (record, search, encode, log, file, format, task, runtime, serverWidget, url, moment, _, AUTHNET) {
        var exports = {};

        function assistant(context){

            log.debug('START')
            log.debug(context.request.method, context.request.parameters)
            var assist = serverWidget.createAssistant(
                {
                    title: 'Authorize.Net Batch Settlement Reconciliation Tool',
                    isNotOrdered: false
                });
            var step1 = assist.addStep({
                id: 'step_1',
                label: 'Dates to Reconcile'
            })
            var step2 = assist.addStep({
                id: 'step_2',
                label: 'Batches against Transactions'
            })
            var step3 = assist.addStep({
                id: 'step_3',
                label: 'Send Feedback!'
            })
            /*var step4 = assist.addStep({
                id: 'step_4',
                label: 'PLACE HOLDER FOR REVIEW?'
            })*/
            if (context.request.method == 'GET') {
                if (!assist.isFinished()) {
                    log.debug(step1)
                    if (assist.currentStep == null) {
                        log.debug('set step1')
                        assist.currentStep = assist.getStep({ id: 'step_1' });
                    }
                    // assist.currentStep = assist.getStep({ id: 'step_1' });
                    step = assist.currentStep.id;
                    //log.debug(step)
                    // STEP1 INIT
                    log.debug('context', context)

                    assist.errorHtml= null;

                    if (step == 'step_1') {
                        log.debug(step)

                        var fld_startDate = assist.addField({
                            id: 'start_date',
                            type: serverWidget.FieldType.DATE,
                            label: 'Settlements Starting On'
                        })
                        fld_startDate.isMandatory = true;

                        var fld_endDate = assist.addField({
                            id: 'end_date',
                            type: serverWidget.FieldType.DATE,
                            label: 'Settlements Ending On'
                        });
                        fld_endDate.isMandatory = true;

                        assist.updateDefaultValues({
                            start_date : moment().startOf('month').toDate(),
                            //start_date : moment().subtract(1,'month').startOf('month').toDate(),
                        });
                        assist.updateDefaultValues({
                            end_date : moment().endOf('month').subtract(1, 'day').toDate(),
                            //start_date : moment().subtract(1,'month').startOf('month').toDate(),
                        });


                        context.response.writePage(assist);
                        // STEP2 INIT

                    } else if (step == 'step_2') {
                        log.debug(step);
                        assist.clientScriptModulePath = '../sac/AuthNet_general_CL2.js';
                        var step_1 = assist.getStep({id: 'step_1'})

                        /*assist.addField({
                            id: 'help',
                            type: serverWidget.FieldType.HELP,
                            label: 'To exclude any invoice from  being part of this email, simply remove the invoice from this listing by clicking the "X" on that row.'
                        });*/
                        var sublist = assist.addSublist({
                            id : 'batchstatus',
                            type : serverWidget.SublistType.INLINEEDITOR,
                            label : 'Settlement Information by Batch'
                        });
                        sublist.addField({
                            id: 'batchid',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Batch Id'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.DISABLED
                        });
                        sublist.addField({
                            id: 'batchtime',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Date Settled'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.DISABLED
                        });
                        sublist.addField({
                            id: 'settlementstate',
                            type: serverWidget.FieldType.TEXT,
                            label: 'settlementState'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.DISABLED
                        });
                        sublist.addField({
                            id: 'settledcount',
                            type: serverWidget.FieldType.INTEGER,
                            label: 'Number Settled'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.DISABLED
                        });
                        sublist.addField({
                            id: 'settledamount',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'Amount Settled'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.DISABLED
                        });
                        sublist.addField({
                            id: 'nscount',
                            type: serverWidget.FieldType.INTEGER,
                            label: 'Number Matched In NS'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.DISABLED
                        });
                        sublist.addField({
                            id: 'nsamount',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'Amount in NS'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.DISABLED
                        });
                        sublist.addField({
                            id: 'delta',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'DELTA'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.DISABLED
                        });

                        sublist.addField({
                            id: 'missinginns',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Missing In NS : Order Number'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.DISABLED
                        });

                        assist.addField({
                            id: 'lookup_batch',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Review Batch Id'
                        });
                        var o_batches = AUTHNET.getSettledBatchListRequest(step_1.getValue({id:'start_date'}), step_1.getValue({id:'end_date'}));
                        log.debug('o_batches',o_batches);
                        if (o_batches.fullResponse) {
                            assist.errorHtml = null;
                            var i_line = 0;
                            _.forEach(o_batches.fullResponse.batchList, function (batch) {
                                var o_nsTxns = {};
                                var o_aNetResponse = AUTHNET.getTransactionListRequest(batch.batchId);
                                o_aNetResponse.settleInforInNs = {
                                    anetTotal: 0,
                                    anetTxnCount: 0,
                                    //anetTxnDeclinedCount : 0,
                                    //anetTxnDeclinedTotal : 0,
                                    anetTxnRefundedCount: 0,
                                    anetTxnRefundedTotal: 0,
                                    nsTotal: 0,
                                    nsTxnCount: 0,
                                    oddballs: [],
                                    missingInNs: [],
                                };
                                search.create({
                                    type: 'transaction',
                                    filters: [
                                        ["custbody_authnet_batchid", "is", batch.batchId],
                                        "AND",
                                        ["mainline", "is", 'T']
                                    ],
                                    columns: [
                                        'amount',
                                        'custbody_authnet_refid',
                                        'memo'
                                    ]
                                }).run().each(function (result) {
                                    //log.debug('result', result);
                                    o_aNetResponse.settleInforInNs.nsTotal += +result.getValue('amount');
                                    o_aNetResponse.settleInforInNs.nsTxnCount++;
                                    o_nsTxns[result.getValue('custbody_authnet_refid')] = {
                                        'id': result.id,
                                        'amount': result.getValue('amount'),
                                        'custbody_authnet_refid': result.getValue('custbody_authnet_refid'),
                                        'memo': result.getValue('memo')
                                    };
                                    return true;
                                });


                                _.forEach(o_aNetResponse.fullResponse.transactions, function (txn) {
                                    if (txn.transactionStatus === 'settledSuccessfully') {
                                        o_aNetResponse.settleInforInNs.anetTotal += txn.settleAmount;
                                        o_aNetResponse.settleInforInNs.anetTxnCount++;
                                        if (!o_nsTxns[txn.transId]) {
                                            o_aNetResponse.settleInforInNs.missingInNs.push(txn)
                                        }
                                    } else if (txn.transactionStatus === 'refundSettledSuccessfully') {
                                        o_aNetResponse.settleInforInNs.anetTxnRefundedTotal += txn.settleAmount;
                                        o_aNetResponse.settleInforInNs.anetTxnRefundedCount++;
                                    } else if (txn.transactionStatus === "declined") {
                                        //o_aNetResponse.settleInforInNs.anetTxnDeclinedTotal += txn.settleAmount;
                                        //o_aNetResponse.settleInforInNs.anetTxnDeclinedCount++;
                                    } else {
                                        o_aNetResponse.settleInforInNs.oddballs.push(txn.transactionStatus);
                                    }

                                });
                                log.debug(batch.batchId + ' :: o_aNetResponse.settleInforInNs', o_aNetResponse.settleInforInNs)

                                sublist.setSublistValue({
                                    id: 'batchid',
                                    line: i_line,
                                    value: batch.batchId,
                                });
                                sublist.setSublistValue({
                                    id: 'batchtime',
                                    line: i_line,
                                    value: moment(batch.settlementTimeLocal).format('M/D/YYYY')
                                });
                                sublist.setSublistValue({
                                    id: 'settlementstate',
                                    line: i_line,
                                    value: batch.settlementState
                                });
                                log.debug(o_aNetResponse.settleInforInNs.anetTxnCount,o_aNetResponse.settleInforInNs.anetTxnCount.toString())
                                sublist.setSublistValue({
                                    id: 'settledcount',
                                    line: i_line,
                                    value: o_aNetResponse.settleInforInNs.anetTxnCount.toString()
                                });
                                sublist.setSublistValue({
                                    id: 'settledamount',
                                    line: i_line,
                                    value: o_aNetResponse.settleInforInNs.anetTotal
                                });
                                sublist.setSublistValue({
                                    id: 'nscount',
                                    line: i_line,
                                    value: o_aNetResponse.settleInforInNs.nsTxnCount.toString()
                                });
                                sublist.setSublistValue({
                                    id: 'nsamount',
                                    line: i_line,
                                    value: o_aNetResponse.settleInforInNs.nsTotal
                                });
                                sublist.setSublistValue({
                                    id: 'delta',
                                    line: i_line,
                                    value: o_aNetResponse.settleInforInNs.anetTotal - o_aNetResponse.settleInforInNs.nsTotal
                                });
                                if (o_aNetResponse.settleInforInNs.missingInNs.length > 0) {
                                    var s_missing = '';
                                    _.forEach(o_aNetResponse.settleInforInNs.missingInNs, function (missingTxn) {
                                        s_missing += '(' + missingTxn.invoiceNumber + ')\r\n';//missingTxn.transId +
                                    });
                                    sublist.setSublistValue({
                                        id: 'missinginns',
                                        line: i_line,
                                        value: s_missing
                                    });
                                }
                                i_line++;
                            });

                        }
                        else
                        {
                            assist.errorHtml =  o_batches.message;
                            //context.response.write(o_batches.message);
                        }

                        //fld_inQueue.defaultValue = a_invoices.length
                        context.response.writePage(assist);
                        // STEP3 INIT

                    } else if (step == 'step_3') {
                        log.debug('redirect' + context.request.body);
                        log.debug(step);

                        var step_1 = assist.getStep({id: 'step_1'});
                        var step_2 = assist.getStep({id: 'step_2'});

                        context.response.writePage(assist);
                    }
                }
            }
            else if (context.request.method == 'POST') {

                if ((assist.getLastAction() == serverWidget.AssistantSubmitAction.NEXT) || (assist.getLastAction() == serverWidget.AssistantSubmitAction.BACK))
                {
                    assist.currentStep = assist.getNextStep();
                    assist.sendRedirect({
                        response: context.response
                    })
                }
                else if(assist.getLastAction() == serverWidget.AssistantSubmitAction.CANCEL)
                {
                    assist.isFinished(true);
                    assist.sendRedirect({
                        response: context.response
                    })
                }
                else if(assist.getLastAction() == serverWidget.AssistantSubmitAction.FINISH)
                {
                    assist.isFinished = true;
                }
            }
        }

        exports.onRequest = assistant;
        return exports;
    });