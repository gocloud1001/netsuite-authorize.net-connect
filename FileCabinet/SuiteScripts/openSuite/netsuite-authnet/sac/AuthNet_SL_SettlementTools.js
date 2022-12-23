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
define(['N/record', 'N/search','N/encode', 'N/log', 'N/file', 'N/format', 'N/redirect', 'N/runtime', 'N/ui/serverWidget', 'N/url', 'moment', 'lodash', './AuthNet_lib'],
    function (record, search, encode, log, file, format, redirect, runtime, serverWidget, url, moment, _, AUTHNET) {
        var exports = {};

        function assistant(context){

            if (context.request.method == 'GET') {

                var o_params = context.request.parameters;
                log.debug(context.request.method, o_params)
                var form = serverWidget.createForm({
                    title: 'Authorize.Net Batch Settlement Reconciliation Tool',
                    hideNavBar: false
                });
                form.clientScriptModulePath = '../sac/AuthNet_general_CL2.js';
                if (o_params.start_date)
                {
                    var sublist = form.addSublist({
                        id : 'batchstatus',
                        type : serverWidget.SublistType.LIST,
                        label : 'Settlement Information by Batch'
                    });
                    sublist.addField({
                        id: 'batchid',
                        type: serverWidget.FieldType.TEXTAREA,
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
                        id: 'refundcount',
                        type: serverWidget.FieldType.INTEGER,
                        label: 'Number Refunded'
                    }).updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.DISABLED
                    });
                    sublist.addField({
                        id: 'refundamount',
                        type: serverWidget.FieldType.CURRENCY,
                        label: 'Amount Refunded'
                    }).updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.DISABLED
                    });
                    sublist.addField({
                        id: 'nscount',
                        type: serverWidget.FieldType.TEXTAREA,
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
                        id: 'delta2',
                        type: serverWidget.FieldType.TEXT,
                        label: 'DELTA'
                    })

                    sublist.addField({
                        id: 'missinginns',
                        type: serverWidget.FieldType.TEXTAREA,
                        label: 'Missing (TRANID : Invoice #)'
                    }).updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.DISABLED
                    });

                    var o_batches, subId;
                    if (o_params.config_sub)
                    {
                        var subConfig = record.load({
                            type : 'customrecord_authnet_config_subsidiary',
                            id : o_params.config_sub
                        });
                        subId = subConfig.getValue({fieldId:'custrecord_ancs_subsidiary'});
                        o_batches = AUTHNET.getSettledBatchListRequest(o_params.start_date, o_params.end_date, subId);
                    }
                    else
                    {
                        o_batches = AUTHNET.getSettledBatchListRequest(o_params.start_date, o_params.end_date);
                    }
                    log.debug('o_batches',o_batches);
                    if (o_batches.fullResponse) {
                        var i_line = 0;
                        _.forEach(o_batches.fullResponse.batchList, function (batch) {
                            var o_nsTxns = {}, o_aNetResponse;
                            if (subId)
                            {
                                o_aNetResponse = AUTHNET.getTransactionListRequest(batch.batchId, subId);
                            }
                            else
                            {
                                o_aNetResponse = AUTHNET.getTransactionListRequest(batch.batchId);
                            }

                            o_aNetResponse.settleInforInNs = {
                                anetTotal: 0,
                                anetTxnCount: 0,
                                //anetTxnDeclinedCount : 0,
                                //anetTxnDeclinedTotal : 0,
                                anetTxnSettledCount: 0,
                                anetTxnSettledTotal: 0,
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
                                log.debug('result', result);
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
                            log.debug('Searched and mathed o_aNetResponse', o_aNetResponse)

                            _.forEach(o_aNetResponse.fullResponse.transactions, function (txn) {
                                if (txn.transactionStatus === 'settledSuccessfully') {
                                    o_aNetResponse.settleInforInNs.anetTxnSettledTotal += txn.settleAmount;
                                    o_aNetResponse.settleInforInNs.anetTxnSettledCount++;
                                    o_aNetResponse.settleInforInNs.anetTotal += txn.settleAmount;
                                    o_aNetResponse.settleInforInNs.anetTxnCount++;
                                    if (!o_nsTxns[txn.transId]) {
                                        o_aNetResponse.settleInforInNs.missingInNs.push(txn)
                                    }
                                } else if (txn.transactionStatus === 'refundSettledSuccessfully') {
                                    o_aNetResponse.settleInforInNs.anetTxnRefundedTotal += txn.settleAmount;
                                    o_aNetResponse.settleInforInNs.anetTxnRefundedCount++;
                                    o_aNetResponse.settleInforInNs.anetTotal -= txn.settleAmount;
                                    o_aNetResponse.settleInforInNs.anetTxnCount++;
                                } else if (txn.transactionStatus === "declined") {
                                    //o_aNetResponse.settleInforInNs.anetTxnDeclinedTotal += txn.settleAmount;
                                    //o_aNetResponse.settleInforInNs.anetTxnDeclinedCount++;
                                } else {
                                    o_aNetResponse.settleInforInNs.oddballs.push(txn.transactionStatus);
                                }

                            });
                            log.debug(batch.batchId + ' :: o_aNetResponse.settleInfoInNs', o_aNetResponse.settleInforInNs)

                            sublist.setSublistValue({
                                id: 'batchid',
                                line: i_line,
                                value: '<a target="_blank" href="/app/common/search/searchresults.nl?searchtype=Transaction&CUSTBODY_AUTHNET_BATCHID='+batch.batchId+'&style=NORMAL&CUSTBODY_AUTHNET_BATCHIDtype=IS&CUSTBODY_AUTHNET_BATCHIDfooterfilter=T&report=&grid=&searchid=customsearch_ans_batch_settlement_detail&dle=T&sortcol=Transction_ORDTYPE9_raw&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&twbx=F">'+batch.batchId+'</a>',
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
                            sublist.setSublistValue({
                                id: 'settledcount',
                                line: i_line,
                                value: o_aNetResponse.settleInforInNs.anetTxnSettledCount.toString()
                            });
                            sublist.setSublistValue({
                                id: 'settledamount',
                                line: i_line,
                                value: o_aNetResponse.settleInforInNs.anetTxnSettledTotal
                            });
                            sublist.setSublistValue({
                                id: 'refundcount',
                                line: i_line,
                                value: o_aNetResponse.settleInforInNs.anetTxnRefundedCount.toString()
                            });
                            sublist.setSublistValue({
                                id: 'refundamount',
                                line: i_line,
                                value: -o_aNetResponse.settleInforInNs.anetTxnRefundedTotal
                            });
                            sublist.setSublistValue({
                                id: 'nscount',
                                line: i_line,
                                value: o_aNetResponse.settleInforInNs.nsTxnCount.toString() + ' <a target="_blank" href="/app/common/search/searchresults.nl?searchtype=Transaction&CUSTBODY_AUTHNET_BATCHID='+batch.batchId+'&style=NORMAL&CUSTBODY_AUTHNET_BATCHIDtype=IS&CUSTBODY_AUTHNET_BATCHIDfooterfilter=T&report=&grid=&searchid=customsearch_ans_batch_settlement_detail&dle=T&sortcol=Transction_ORDTYPE9_raw&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&twbx=F">(Details)</a>'
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
                            sublist.setSublistValue({
                                id: 'delta2',
                                line: i_line,
                                value: o_aNetResponse.settleInforInNs.anetTotal - o_aNetResponse.settleInforInNs.nsTotal > 0 ? '<span style="color:red;">'+(o_aNetResponse.settleInforInNs.anetTotal - o_aNetResponse.settleInforInNs.nsTotal).toFixed(2)+'</span>' : '0'
                            });
                            if (o_aNetResponse.settleInforInNs.missingInNs.length > 0) {
                                var s_missing = '';
                                _.forEach(o_aNetResponse.settleInforInNs.missingInNs, function (missingTxn) {
                                    var o_config = {missingtranid:missingTxn.transId};
                                    if (context.request.parameters.config_sub)
                                    {
                                        o_config.config_sub = context.request.parameters.config_sub;
                                    }
                                    var s_missingLink = url.resolveScript({
                                        scriptId: runtime.getCurrentScript().id,
                                        deploymentId: runtime.getCurrentScript().deploymentId,
                                        params: o_config
                                    });
                                    var s_invNumber = _.isUndefined(missingTxn.invoiceNumber) ? '' : ' : '+missingTxn.invoiceNumber;
                                    s_missing +=
                                        ' <a target="_blank" href="'+s_missingLink+'">' + missingTxn.transId + s_invNumber + '</a>\r\n'
                                        //'(' + missingTxn.transId + ' : '+missingTxn.invoiceNumber + ')\r\n';//missingTxn.transId +
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


                }
                else if (o_params.missingtranid)
                {
                    form.title = 'Missing Authorize.Net Transaction Id '+o_params.missingtranid;
                    //lookup the missing transaction and pull details to show to the user here
                    var o_missingTxn;
                    if (o_params.config_sub)
                    {
                        o_missingTxn = AUTHNET.getStatusCheck(o_params.missingtranid, o_params.config_sub);
                    }
                    else
                    {
                        o_missingTxn = AUTHNET.getStatusCheck(o_params.missingtranid);
                    }
                    if (o_missingTxn)
                    {
                        var o_matchedTranId, o_matchedCustomer;
                        search.create({
                            type: 'transaction',
                            filters: [
                                ['tranid', 'is', o_missingTxn.fullResponse.order.invoiceNumber],
                                "AND",
                                ['mainline', 'is', 'T'],
                            ],
                            columns: [
                                {name: 'tranid'},
                                {name: 'entity'},
                            ]
                        }).run().each(function (result) {
                            o_matchedTranId = {id : result.id, type : result.recordType, tranid : result.getValue('tranid'), entity : +result.getValue('entity')};
                            log.debug('FOUND TRANSACTION', o_matchedTranId);
                        });
                        search.create({
                            type: 'customer',
                            filters: [
                                ['email', 'is', o_missingTxn.fullResponse.customer.email],
                                "AND",
                                ['isinactive', 'is', 'F'],
                            ],
                            columns: [
                                {name: 'entityid'},
                            ]
                        }).run().each(function (result) {
                            //log.debug('result', result);
                            if (o_matchedTranId)
                            {
                                if (+result.id === o_matchedTranId.entity)
                                {
                                    o_matchedCustomer = {id : +result.id, type : result.recordType, entityid : result.getValue('entityid')};
                                    log.debug('FOUND CUSTOMER', o_matchedCustomer);
                                    return false;
                                }
                            }
                            else
                            {
                                o_matchedCustomer = {id : +result.id, type : result.recordType, entityid : result.getValue('entityid')};
                            }
                            return true;
                        });
                        var grp_matching = form.addFieldGroup({
                            id: 'grp_matching',
                            label: 'Possible Related Transaction within NetSuite'
                        });
                        if (o_matchedTranId)
                        {

                            form.addField({
                                id: 'matchedtxn',
                                type: serverWidget.FieldType.SELECT,
                                source : 'transaction',
                                label: 'Likely Source NetSuite Transaction',
                                container:'grp_matching'
                            }).updateDisplayType({
                                displayType : serverWidget.FieldDisplayType.INLINE
                            });
                            form.updateDefaultValues({
                                matchedtxn: o_matchedTranId.id,
                            });
                            if (o_matchedTranId.type === 'invoice')
                            {
                                //probally need to create a payment from this transaction
                            }
                        }
                        if (o_matchedCustomer)
                        {
                            form.addField({
                                id: 'matchedcustomer',
                                type: serverWidget.FieldType.SELECT,
                                source : 'customer',
                                label: 'Likely Source NetSuite Customer',
                                container:'grp_matching'
                            }).updateDisplayType({
                                displayType : serverWidget.FieldDisplayType.INLINE
                            });
                            form.updateDefaultValues({
                                matchedcustomer: o_matchedCustomer.id,
                            });
                            if (o_matchedTranId)
                            {
                                if (o_matchedTranId.entity !== o_matchedCustomer.id)
                                {
                                    form.addField({
                                        id: 'custwarning',
                                        type: serverWidget.FieldType.HELP,
                                        label: 'The matched customer based off the email address does not match the customer on the invoice.  This may be fine or it may be an issue.',
                                    });

                                }
                            }
                        }
                        var grp_missing = form.addFieldGroup({
                            id: 'grp_missing',
                            label: 'Missing Transaction Details'
                        });

                        form.addField({
                            id: 'ext_invid',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Missing Transaction #',
                            container:'grp_missing'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.INLINE
                        });
                        form.updateDefaultValues({
                            ext_invid:o_missingTxn.fullResponse.order.invoiceNumber
                        });

                        form.addField({
                            id: 'ext_date',
                            type: serverWidget.FieldType.DATE,
                            label: 'Missing Transaction Date',
                            container:'grp_missing'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.INLINE
                        });
                        form.updateDefaultValues({
                            ext_date: moment(o_missingTxn.fullResponse.submitTimeLocal).toDate()
                        });

                        form.addField({
                            id: 'ext_amount',
                            type: serverWidget.FieldType.CURRENCY,
                            label: 'Missing Transaction Amount',
                            container:'grp_missing'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.INLINE
                        });
                        form.updateDefaultValues({
                            ext_amount: o_missingTxn.fullResponse.authAmount
                        });

                        form.addField({
                            id: 'ext_billinginfo',
                            type: serverWidget.FieldType.TEXTAREA,
                            label: 'Missing Transaction Billing Details',
                            container:'grp_missing'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.INLINE
                        });
                        form.updateDefaultValues({
                            ext_billinginfo:
                                o_missingTxn.fullResponse.billTo.firstName + ' ' + o_missingTxn.fullResponse.billTo.lastName + '\n' +
                                o_missingTxn.fullResponse.billTo.address + '\n' +
                                o_missingTxn.fullResponse.billTo.city + ', '+o_missingTxn.fullResponse.billTo.state + ' ' + o_missingTxn.fullResponse.billTo.zip + '\n'
                        });

                        form.addField({
                            id: 'ext_pmtmth',
                            type: serverWidget.FieldType.TEXTAREA,
                            label: 'Missing Transaction Payment Details',
                            container:'grp_missing'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.INLINE
                        });
                        var s_paymentString = '';
                        if (o_missingTxn.fullResponse.payment.creditCard)
                        {
                            s_paymentString += o_missingTxn.fullResponse.payment.creditCard.cardType + '\n'+
                                o_missingTxn.fullResponse.payment.creditCard.cardNumber + '\n'
                        }
                        else
                        {
                            s_paymentString += 'ACH - eCheck'
                        }
                        form.updateDefaultValues({
                            ext_pmtmth:s_paymentString
                        });
                    }
                }
                else {

                    //get the config and determine if this is sub or not
                    var o_config = AUTHNET.getConfigFromCache();
                    if (o_config.mode === 'subsidiary') {
                        var fld_config = form.addField({
                            id: 'config_sub',
                            type: serverWidget.FieldType.SELECT,
                            source: 'customrecord_authnet_config_subsidiary',
                            label: 'Processing Gateway'
                        })
                        fld_config.isMandatory = true;
                    }

                    var fld_startDate = form.addField({
                        id: 'start_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'Settlements Starting On'
                    })
                    fld_startDate.isMandatory = true;

                    var fld_endDate = form.addField({
                        id: 'end_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'Settlements Ending On'
                    });
                    fld_endDate.isMandatory = true;

                    form.updateDefaultValues({
                        start_date: moment().startOf('month').toDate(),
                        //start_date : moment().subtract(1,'month').startOf('month').toDate(),
                    });
                    form.updateDefaultValues({
                        end_date: moment().endOf('month').subtract(1, 'day').toDate(),
                        //start_date : moment().subtract(1,'month').startOf('month').toDate(),
                    });
                    form.addSubmitButton({
                        id : 'submit',
                        label : 'Submit'
                    });
                }


                context.response.writePage(form);

            }
            else if (context.request.method == 'POST') {

                log.debug('params', context.request.parameters);
                if (context.request.parameters.start_date && context.request.parameters.end_date) {
                    var o_config = {
                        start_date: context.request.parameters.start_date,
                        end_date: context.request.parameters.end_date,
                    };
                    if (context.request.parameters.config_sub)
                    {
                        o_config.config_sub = context.request.parameters.config_sub;
                    }

                    redirect.toSuitelet({
                        scriptId: runtime.getCurrentScript().id,
                        deploymentId: runtime.getCurrentScript().deploymentId,
                        parameters: o_config
                    });
                }
                else if (context.request.parameters.missingtranid)
                {

                }

            }
        }

        exports.onRequest = assistant;
        return exports;
    });