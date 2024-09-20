/**
 * @exports XXX
 *
 * @copyright 2024 Cloud 1001, LLC
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
                        label: 'All Transactions Matched In NS'
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
                        id: 'delta2',
                        type: serverWidget.FieldType.TEXT,
                        label: 'DELTA'
                    });
                    sublist.addField({
                        id: 'missing',
                        type: serverWidget.FieldType.TEXT,
                        label: '# Transactions Missing in NS'
                    });

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
                                anetTxnVoidedCount: 0,
                                anetTxnVoidedTotal: 0,
                                nsTotal: 0,
                                nsTxnCount: 0,
                                shouldNotPost: [],
                                oddballs: [],
                                missingInNs: [],
                            };
                            search.create({
                                type: 'transaction',
                                filters: [
                                    ['type', 'anyof', ["CashRfnd", "CashSale", "CustDep","CustRfnd","CustPymt", "CustCred"]],
                                    "AND",
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
                            log.debug('Searched and mathed o_aNetResponse', o_aNetResponse);

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
                                    if (!o_nsTxns[txn.transId]) {
                                        o_aNetResponse.settleInforInNs.missingInNs.push(txn)
                                    }
                                } else if (txn.transactionStatus === "voided") {
                                    o_aNetResponse.settleInforInNs.anetTxnVoidedTotal += txn.settleAmount;
                                    o_aNetResponse.settleInforInNs.anetTxnVoidedCount++;
                                    //o_aNetResponse.settleInforInNs.anetTotal -= txn.settleAmount;
                                    //o_aNetResponse.settleInforInNs.anetTxnCount++;
                                    if (o_nsTxns[txn.transId]) {
                                        //need to show this because it's voided and should not be a posting transaction!
                                        //o_aNetResponse.settleInforInNs.missingInNs.push(txn)
                                        o_aNetResponse.settleInforInNs.shouldNotPost.push(txn.transactionStatus);
                                    }
                                }
                                else {
                                    o_aNetResponse.settleInforInNs.oddballs.push(txn.transactionStatus);
                                }
                            });
                            log.debug(batch.batchId + ' :: o_aNetResponse.settleInfoInNs', o_aNetResponse.settleInforInNs)

                            if (o_aNetResponse.settleInforInNs.shouldNotPost.length > 0)
                            {
                                sublist.addField({
                                    id: 'voided',
                                    type: serverWidget.FieldType.TEXTAREA,
                                    label: 'Voided but posting'
                                }).updateDisplayType({
                                    displayType : serverWidget.FieldDisplayType.DISABLED
                                });
                            }

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
                            var _message = o_aNetResponse.settleInforInNs.nsTxnCount === (o_aNetResponse.settleInforInNs.anetTxnSettledCount + o_aNetResponse.settleInforInNs.anetTxnRefundedCount)? 'Details' : 'Details';
                            sublist.setSublistValue({
                                id: 'nscount',
                                line: i_line,
                                value: '<b>'+o_aNetResponse.settleInforInNs.nsTxnCount.toString() + '</b> <a target="_blank" href="/app/common/search/searchresults.nl?searchtype=Transaction&CUSTBODY_AUTHNET_BATCHID='+batch.batchId+'&style=NORMAL&CUSTBODY_AUTHNET_BATCHIDtype=IS&CUSTBODY_AUTHNET_BATCHIDfooterfilter=T&report=&grid=&searchid=customsearch_ans_batch_settlement_detail&dle=T&sortcol=Transction_ORDTYPE9_raw&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&twbx=F">('+ _message +')</a>'
                            });
                            sublist.setSublistValue({
                                id: 'nsamount',
                                line: i_line,
                                value: o_aNetResponse.settleInforInNs.nsTotal
                            });
                            var _missing = Math.abs((o_aNetResponse.settleInforInNs.anetTxnSettledCount + o_aNetResponse.settleInforInNs.anetTxnRefundedCount - o_aNetResponse.settleInforInNs.nsTxnCount));

                            sublist.setSublistValue({
                                id: 'missing',
                                line: i_line,
                                value: _missing !== 0 ? '<span style="color:red;font-weight: bold;">'+_missing.toString()+'</span>' : _missing.toString()
                            });
                            var _delta = format.format({value: o_aNetResponse.settleInforInNs.anetTotal - o_aNetResponse.settleInforInNs.nsTotal, type: format.Type.CURRENCY});
                            sublist.setSublistValue({
                                id: 'delta2',
                                line: i_line,
                                value: +_delta !== 0 ? '<span style="color:red;font-weight: bold;">'+_delta+'</span>' : _delta
                            });
                            log.debug('_delta',_delta);
                            log.debug('o_aNetResponse.settleInforInNs.missingInNs',o_aNetResponse.settleInforInNs.missingInNs);
                            if (o_aNetResponse.settleInforInNs.missingInNs.length > 0) {
                                var s_missing = '';
                                _.forEach(o_aNetResponse.settleInforInNs.missingInNs, function (missingTxn) {
                                    log.debug('missingTxn', missingTxn)
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
                                    var amount = '$'+missingTxn.settleAmount;
                                    if (missingTxn.transactionStatus === 'refundSettledSuccessfully')
                                    {
                                        amount =  '<span style="color:red;font-weight: bold;">('+'$'+missingTxn.settleAmount+')</span>'
                                    }
                                    s_missing +=
                                        ' <a target="_blank" href="'+s_missingLink+'">' +amount + ' : '+ missingTxn.transId + s_invNumber + '</a>\r\n';
                                    if (s_missing.length > 3800)
                                    {
                                        s_missing += ' (more)'
                                        return false;
                                    }
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
                        form.errorHtml =  o_batches.message;
                        //context.response.write(o_batches.message);
                    }


                }
                else if (o_params.missingtranid)
                {
                    form.title = 'Missing Authorize.Net Transaction Id '+o_params.missingtranid;
                    //lookup the missing transaction and pull details to show to the user here
                    var o_missingTxn, o_config2;
                    if (o_params.config_sub)
                    {
                        o_missingTxn = AUTHNET.getStatusCheck(o_params.missingtranid, o_params.config_sub);
                        o_config2 = AUTHNET.getConfigFromCache(o_params.config_sub);
                    }
                    else
                    {
                        o_missingTxn = AUTHNET.getStatusCheck(o_params.missingtranid);
                        o_config2 = AUTHNET.getConfigFromCache();
                    }
                    //log.debug('o_config2', o_config2);
                    //log.debug('o_missingTxn', o_missingTxn);
                    if (o_missingTxn)
                    {
                        var o_matchedTranId, o_matchedCustomer;
                        if (o_missingTxn.fullResponse.order.invoiceNumber) {
                            var a_filters = [
                                ['tranid', 'is', o_missingTxn.fullResponse.order.invoiceNumber],
                                "AND",
                                ['type', 'anyof', ["SalesOrd", "CashRfnd", "CashSale", "CustDep", "CustRfnd", "CustPymt"]],
                                "AND",
                                ['mainline', 'is', 'T'],
                            ];
                            if (o_config2.custrecord_an_external_fieldid.val)
                            {
                                a_filters = [
                                    [
                                        ['tranid', 'is', o_missingTxn.fullResponse.order.invoiceNumber],
                                        "OR",
                                        [o_config2.custrecord_an_external_fieldid.val, 'is', o_missingTxn.fullResponse.order.invoiceNumber]
                                    ],
                                    "AND",
                                    ['type', 'anyof', [ "CashRfnd", "CashSale", "CustDep", "CustRfnd", "CustPymt", "CustCred"]],
                                    "AND",
                                    ['mainline', 'is', 'T'],
                                ]
                            }
                            search.create({
                                type: 'transaction',
                                filters: a_filters,
                                columns: [
                                    {name: 'tranid'},
                                    {name: 'entity'},
                                ]
                            }).run().each(function (result) {
                                o_matchedTranId = {
                                    id: result.id,
                                    type: result.recordType,
                                    tranid: result.getValue('tranid'),
                                    entity: +result.getValue('entity')
                                };
                                log.debug('FOUND TRANSACTION', o_matchedTranId);
                            });
                            if (o_matchedTranId) {
                                if (o_matchedTranId.type === 'invoice') {
                                    //probally need to create a payment from this transaction
                                    search.create({
                                        type: 'transaction',
                                        filters: [
                                            ['appliedtotransaction.internalid', 'anyof', o_matchedTranId.id],
                                        ],
                                        columns: [
                                            {name: 'tranid'},
                                            {name: 'entity'},
                                        ]
                                    }).run().each(function (result) {
                                        o_matchedTranId.applied = {
                                            id: result.id,
                                            type: result.recordType,
                                            tranid: result.getValue('tranid')
                                        };
                                        log.debug('FOUND TRANSACTION APPLIED', o_matchedTranId.applied);
                                    });
                                }

                                else if (o_matchedTranId.type === 'creditmemo')
                                {
                                    //see what it's applied to
                                    search.create({
                                        type: 'transaction',
                                        filters: [
                                            ['internalid', 'anyof', o_matchedTranId.id],
                                        ],
                                        columns: [
                                            {name: 'tranid'},
                                            {name: 'entity'},
                                            {name: 'appliedtotransaction'},
                                            {name: 'appliedtolinktype'},
                                            //todo - add these above and use to offer guidance on the transaction that's missing / but found
                                            {join: 'appliedtotransaction', name : 'custbody_authnet_refid'},
                                            {join: 'appliedtotransaction', name : 'custbody_authnet_settle_status'},
                                            {join: 'appliedtotransaction', name : 'custbody_authnet_batchid'},
                                        ]
                                    }).run().each(function (result) {
                                        //log.debug('cm result', result);
                                        o_matchedTranId.applied = {
                                            id: result.getValue('appliedtotransaction'),
                                            type: result.getValue('appliedtolinktype'),
                                            tranid: result.getText('appliedtotransaction')
                                        };
                                        log.debug('FOUND TRANSACTION APPLYING', o_matchedTranId.applied);
                                    });
                                }
                            }
                        }
                        //if (o_missingTxn.fullResponse.customer.email || o_missingTxn.fullResponse.customer.id) {
                        var a_filters = [['isinactive', 'is', 'F'], "AND"];
                        var a_subFilter = [];
                        if (o_missingTxn.fullResponse.customer.email)
                        {
                            a_subFilter.push(['email', 'is', o_missingTxn.fullResponse.customer.email]);
                        }
                        if (o_missingTxn.fullResponse.customer.id)
                        {
                            if (a_subFilter.length > 0)
                            {
                                a_subFilter.push("OR");
                            }
                            a_subFilter.push(['entityid', 'contains', o_missingTxn.fullResponse.customer.id]);
                        }
                        if (a_subFilter.length > 0)
                        {
                            a_subFilter.push("OR");
                        }
                        a_subFilter.push(['altname', 'is', o_missingTxn.fullResponse.billTo.firstName + ' ' + o_missingTxn.fullResponse.billTo.lastName])
                        a_filters.push(a_subFilter)
                        //log.debug('a_filters', a_filters);
                        search.create({
                            type: 'customer',
                            filters :a_filters,
                            columns: [
                                {name: 'entityid'},
                            ]
                        }).run().each(function (result) {
                            //log.debug('result', result);
                            if (o_matchedTranId) {
                                if (+result.id === o_matchedTranId.entity) {
                                    o_matchedCustomer = {
                                        id: +result.id,
                                        type: result.recordType,
                                        entityid: result.getValue('entityid')
                                    };
                                    log.debug('FOUND CUSTOMER', o_matchedCustomer);
                                    return false;
                                }
                            } else {
                                o_matchedCustomer = {
                                    id: +result.id,
                                    type: result.recordType,
                                    entityid: result.getValue('entityid')
                                };
                            }
                            return true;
                        });
                        //}
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
                            if (o_matchedTranId.applied) {
                                form.addField({
                                    id: 'matchedtxnapplied',
                                    type: serverWidget.FieldType.SELECT,
                                    source: 'transaction',
                                    label: 'Likely NetSuite Payment Transaction',
                                    container: 'grp_matching'
                                }).updateDisplayType({
                                    displayType: serverWidget.FieldDisplayType.INLINE
                                });
                                form.updateDefaultValues({
                                    matchedtxnapplied: o_matchedTranId.applied.id,
                                });
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
                            id: 'ext_tranid',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Authorize.Net TranID',
                            container:'grp_missing'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.INLINE
                        });
                        form.updateDefaultValues({
                            ext_tranid:o_missingTxn.fullResponse.transId
                        });

                        form.addField({
                            id: 'ext_invid',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Missing Transaction #',
                            container:'grp_missing'
                        }).updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.INLINE
                        });
                        if (o_missingTxn.fullResponse.order.invoiceNumber) {
                            form.updateDefaultValues({
                                ext_invid: o_missingTxn.fullResponse.order.invoiceNumber
                            });
                        }
                        else
                        {
                            form.updateDefaultValues({
                                ext_invid: 'Not found in Authorize.Net'
                            });
                        }
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
                    log.debug('runtime.getCurrentUser().roleId',runtime.getCurrentUser())
                    if (+runtime.getCurrentUser().role === 3)
                    {
                        var i_deploymentId;
                        search.create({
                            type:'scriptdeployment',
                            filters : [
                                ['scriptid', 'is', [ "CUSTOMDEPLOY_SAC_SL2_SETTLEMENT_TOOLS" ]]
                            ]
                        }).run().each(function(result){
                            i_deploymentId = +result.id;
                        });
                        form.addTab({
                            id : 'custpage_administrator',
                            label : 'Administrator Role Notes'
                        });
                        form.addField({
                            id: 'custpage_insub_mode',
                            label: '<b>Administrator Note: </b>You may want to add this tool to individual roles as not all roles use the Classic Center view like this one.<br/>' +
                                'To do so, from the <a href="/app/common/scripting/scriptrecord.nl?id='+i_deploymentId+'" target="_blank">deployment for this tool</a>, select Edit.<br/>' +
                                'Then from the Links tab, add the Center used by the Role that should see the tool and select the section and category where the tool should show for that role as well.<br/>' +
                                'NOTE : Every time your versions of software are updated, these settings will need to be updated.',
                            type: serverWidget.FieldType.HELP,
                            container : 'custpage_administrator'
                        });
                    }
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