/**
 * Module Description...
 *
 * @exports XXX
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
 * IN NO EVENT SHALL CLOUD 1001, LLC, LLC BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF CLOUD 1001, LLC HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * CLOUD 1001, LLC SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE AND ACCOMPANYING DOCUMENTATION, IF ANY, PROVIDED HEREUNDER IS PROVIDED "AS IS". CLOUD 1001, LLC HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
 *
 * @author Andy Prior <andy@gocloud1001.com>
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @NScriptType Suitelet
 *
 *
 * @NAmdConfig /SuiteScripts/openSuite/netsuite-authnet/config.json
 *
 */
define(['N/record', 'N/ui/serverWidget', 'N/http', 'N/render', 'N/crypto', 'N/error', 'N/file', 'N/runtime', 'N/url', 'N/encode', 'N/search', 'N/redirect', 'N/format', 'N/config', 'lodash', 'moment', 'authNetC2P'],
    function (record, serverWidget, http, render, crypto, error, file, runtime, url, encode, search, redirect, format, config, _, moment, authNetC2P) {

        const exports = {};
        function renderErrorPage(o_error)
        {
            let errorPageHTML = file.load('SuiteScripts/openSuite/netsuite-authnet/sac/click2pay/html/authnet_click2pay_error.html');
            let s_contents = errorPageHTML.getContents();
            s_contents = s_contents.replace('{{CODE}}', o_error.code);
            s_contents = s_contents.replace('{{MESSAGE}}', o_error.message);
            s_contents = s_contents.replace('{{COMPANY_NAME}}', _.isUndefined(o_error.config.custrecord_an_txn_companyname) ? '' : o_error.config.custrecord_an_txn_companyname.val);
            s_contents = s_contents.replace('{{FORM_LOGO}}', _.isUndefined(o_error.config.logofile) ? '' : o_error.config.logofile);
            return s_contents;
        }
        function renderResultPage(o_error)
        {
            //log.debug('renderResultPage', o_error)
            let errorPageHTML = file.load('SuiteScripts/openSuite/netsuite-authnet/sac/click2pay/html/authnet_click2pay_onlinepayment_result.html');
            let s_contents = errorPageHTML.getContents();
            s_contents = s_contents.replace('{{CODE}}', o_error.code);
            s_contents = s_contents.replace('{{MESSAGE}}', o_error.message);
            s_contents = s_contents.replace('{{COMPANY_NAME}}', _.isUndefined(o_error.config.custrecord_an_txn_companyname) ? '' : o_error.config.custrecord_an_txn_companyname.val);
            s_contents = s_contents.replace('{{FORM_LOGO}}', _.isUndefined(o_error.config.logofile) ? '' : o_error.config.logofile);
            return s_contents;
        }
        function onRequest(context) {
            //log.debug(context.request.method, context.request)
            if (context.request.method === 'GET') {
                //
                var o_allParams = context.request.parameters;
                log.debug('GET context.request.parameters: '+context.request.clientIpAddress, o_allParams);
                //log.debug('GET address', context.request.clientIpAddress);
                log.debug(context.request.clientIpAddress, context.request.headers["User-Agent"]);

                if (!_.isEmpty(context.request.parameters._fid) && context.request.parameters.fl === 'true')
                {
                    let o_config2 = {config:{}}
                    try {
                        let o_fieldIDpayload = JSON.parse(authNetC2P.crypto.decode64(o_allParams._fid));
                        let invoiceId =  authNetC2P.crypto.decrypt(o_fieldIDpayload, 'custsecret_authnet_payment_link');
                        let o_invoiceRec = record.load({
                            type : 'invoice',
                            id : invoiceId
                        });
                        let invoicePDF = render.transaction({
                            entityId: +invoiceId,
                            printMode: render.PrintMode.PDF,
                            inCustLocale: true
                        });
                        context.response.addHeader({
                            name: 'Content-Type:',
                            value: 'application/pdf'
                        });
                        context.response.addHeader({
                            name: 'Content-Disposition',
                            value: 'inline; filename="'+o_invoiceRec.getValue({fieldId:'tranid'})+'.pdf"'
                        });

                        context.response.writeFile({file: invoicePDF, isinline: true});
                    }
                    catch (e)
                    {
                        log.error(e.name, e.message);
                        log.error(e.name, e.stack);
                        context.response.write(renderResultPage({config : o_config2, code:'404 : File Not Found', message : 'The file you are attempting to download was not found or there was an issue accessing it.'}));
                    }
                    return;
                }
                else if (!_.isEmpty(context.request.parameters._sid) && context.request.parameters.st === 'true')
                {
                    let o_config2 = {config:{}}
                    try {
                        let o_fieldIDpayload = JSON.parse(authNetC2P.crypto.decode64(o_allParams._sid));
                        let invoiceId =  authNetC2P.crypto.decrypt(o_fieldIDpayload, 'custsecret_authnet_payment_link');
                        let o_invoiceRec = record.load({
                            type : 'invoice',
                            id : invoiceId
                        });
                        let invoicePDF = render.statement({
                            entityId: +o_invoiceRec.getValue({fieldId:'entity'}),
                            printMode: render.PrintMode.PDF,
                            inCustLocale: true
                        });
                        context.response.addHeader({
                            name: 'Content-Type:',
                            value: 'application/pdf'
                        });
                        context.response.addHeader({
                            name: 'Content-Disposition',
                            value: 'inline; filename="Current Statement.pdf"'
                        });

                        context.response.writeFile({file: invoicePDF, isinline: true});
                    }
                    catch (e)
                    {
                        log.error(e.name, e.message);
                        log.error(e.name, e.stack);
                        context.response.write(renderResultPage({config : o_config2, code:'404 : File Not Found', message : 'The file you are attempting to download was not found or there was an issue accessing it.'}));
                    }
                    return;
                }
                else if (!o_allParams.xkcd)
                {
                    log.error('UNDEFINED REQUEST - no element', context.request.clientIpAddress)
                    context.response.write('200 : OK logged from '+context.request.clientIpAddress);
                    return;
                }
                //decrypt the id for the record
                let o_payload = JSON.parse(authNetC2P.crypto.decode64(o_allParams.xkcd));
                //log.debug('o_payload', o_payload);
                let recordId =  authNetC2P.crypto.decrypt(o_payload, 'custsecret_authnet_payment_link');
                log.debug('GET Decrypted recordId', recordId);
                if (!recordId)
                {
                    log.error('Unable to decrypt xkcd', 'Value failed to decrypt so we can not proceed');
                    context.response.write(context.request.clientIpAddress +' : requested a value may have been tampered with and is unreadable.');
                    return;
                }
                let o_invoiceRec = record.load({
                    type : 'invoice',
                    id : recordId
                });
                //now get authnet config data to build the UI accordilngly
                let o_config2 = authNetC2P.authNet.getCache(o_invoiceRec);
                //log.debug('GET o_config2', o_config2);
                log.debug('Invoice Status', o_invoiceRec.getValue({fieldId: 'status'}) === 'Open')
                if (o_invoiceRec.getValue({fieldId: 'status'}) === 'Open' && o_invoiceRec.getValue({fieldId: 'amountremaining'}) > 0) {
                    //if this is not set - then by all means force the cache to be cleared on the page
                    if (!o_allParams.cac) {
                        log.audit('New / Clean request', 'So request is no cache for the page!');
                        context.response.setHeader({
                            name: 'Cache-Control',
                            value: 'no-store',
                        });
                    }
                    //open tracking logic
                    let m_now = moment().toDate();

                    //lookup the total of open invoices off this record
                    let o_totalDue = authNetC2P.paymentlink.invoiceAmountDue(o_invoiceRec);
                    //log.debug('o_totalDue', o_totalDue)
                    if (+o_totalDue.asNumber === 0)
                    {
                        context.response.write(renderResultPage({code:'Paid In Full', message : 'This invoice has already been paid in full - Thank you'}));
                        //context.response.write('This invoice has already been paid in full - Thank you');
                        return;
                    }
                    let suiteletURL = authNetC2P.paymentlink.serviceUrl();
                    let payPageHTML = file.load('SuiteScripts/openSuite/netsuite-authnet/sac/click2pay/html/authnet_click2pay_index.html');
                    let s_payPageHTML = payPageHTML.getContents();
                    s_payPageHTML = s_payPageHTML.replace('{{FORMLINK}}', suiteletURL);
                    s_payPageHTML = s_payPageHTML.replace('{{BALANCE}}', o_totalDue.asCurrency);
                    s_payPageHTML = s_payPageHTML.replace('{{COMPANY_NAME}}', o_config2.custrecord_an_txn_companyname.val);
                    s_payPageHTML = s_payPageHTML.replace('{{FORM_LOGO}}', o_config2.logofile);

                    //DISPLAY OR NOT THE PDF OF THE INVOICE

                    let s_pdfLink = '';
                    let o_encryptedPDFId = authNetC2P.crypto.encrypt(recordId, 'custsecret_authnet_payment_link');
                    let s_encodedID = authNetC2P.crypto.encode64(JSON.stringify(o_encryptedPDFId));
                    if (o_config2.custrecord_an_click2pay_allow_invoice.val) {
                        s_pdfLink = suiteletURL + '&_fid=' + s_encodedID + '&fl=true';
                        if (s_pdfLink) {
                            s_pdfLink = '<p><a target="_blank" href="' + s_pdfLink + '">Download Invoice PDF</a></p>'
                        }
                    }
                    s_payPageHTML = s_payPageHTML.replace('{{INVPDF}}', s_pdfLink);
                    //DISPLAY OR NOT THE PDF OF THE STATEMENT
                    let s_statementLink = '';
                    if (o_config2.custrecord_an_click2pay_allow_statemen.val)
                    {
                        s_statementLink = suiteletURL + '&_sid=' + s_encodedID + '&st=true';
                        s_statementLink = '<p><a target="_blank" href="'+s_statementLink+'">Download Statement PDF</a></p>';
                        //log.debug('s_statementLink',s_statementLink);
                    }
                    s_payPageHTML = s_payPageHTML.replace('{{CUSTSTATEMENT}}', s_statementLink);
                    /*//now lookup the validation.js file URL and embed it into the form
                    search.create({
                        type: 'file',
                        filters: [
                            ['name', 'is', 'authnet_click2pay_onlinepayment_vaildation.js'],
                        ],
                        columns:
                            [
                                'url',
                            ]
                    }).run().each(function (result)
                    {
                        s_payPageHTML = s_payPageHTML.replace('{{VALIDATION_SCRIPT}}', result.getValue('url'));
                        return true;
                    });*/
                    //now set all the billing information fields
                    let a_columns = [
                        'isperson',
                        'email',
                        'firstname',
                        'lastname',
                        'companyname',
                        'billaddress1',
                        'billaddress2',
                        'billcity',
                        'billcountry',
                        'billcountrycode',
                        'billstate',
                        'billzipcode',
                        'billphone',
                    ];
                    let s_billingState = '';
                    search.create({
                        type: 'customer',
                        filters: [
                            ['internalid', 'anyof', [o_invoiceRec.getValue({fieldId: 'entity'})]],
                        ],
                        columns: [
                            'isperson',
                            'email',
                            'firstname',
                            'lastname',
                            'companyname',
                            'billaddress1',
                            'billaddress2',
                            'billcity',
                            'billcountry',
                            'billcountrycode',
                            'billstate',
                            'billzipcode',
                            'billphone',
                        ]
                    }).run().each(function (result)
                    {
                        //log.debug('billing lookup results', result)
                        _.forEach(a_columns, function (fldId)
                        {
                            s_payPageHTML = s_payPageHTML.replace('{{' + fldId + '}}', result.getValue(fldId) ? result.getValue(fldId) : '');
                        });
                        s_billingState = result.getValue('billstate');
                        return true;
                    });
                    //build the list of states to select for a new card
                    let s_stateSelection ='';
                    search.create({
                        type:'state',
                        filters : [
                            ['country', 'anyof', ['US']],
                        ],
                        columns :
                            [
                                'id',
                                'fullname',
                                'shortname',
                            ]
                    }).run().each(function (result) {
                        if (result.getValue('shortname') === s_billingState)
                        {
                            s_stateSelection += '<option selected="" value="' + result.getValue('shortname') + '">' + result.getValue('fullname') + '</option>'
                        }
                        else
                        {
                            s_stateSelection += '<option value="' + result.getValue('shortname') + '">' + result.getValue('fullname') + '</option>'
                        }
                        return true;
                    });
                    s_payPageHTML = s_payPageHTML.replace('{{STATESELECTION}}', s_stateSelection);

                    //now get all the CIM / tokens / cards this customer has
                    let s_cardOptions = '', b_hasDefault = false;
                    search.create({
                        type: 'customrecord_authnet_tokens',
                        filters: [
                            ['custrecord_an_token_entity', 'anyof', [o_invoiceRec.getValue({fieldId: 'entity'})]],
                            "AND",
                            ['isinactive', 'is', false],
                            "AND",
                            ['custrecord_an_token_pblkchn_tampered', 'is', false],
                        ],
                        columns:
                            [
                                'name',
                                'custrecord_an_token_default',
                            ]
                    }).run().each(function (result)
                    {
                        let _selectOption = '', s_cardName = result.getValue('name');
                        //if this is multi sub customer
                        if (o_config2.hasMultiSubRuntime)
                        {
                            s_cardName = s_cardName.replace('('+o_config2.custrecord_an_card_prefix.val+') ', '');
                        }
                        if (result.getValue('custrecord_an_token_default')) {
                            _selectOption = '<option selected="" value="' + result.id + '">' + s_cardName + '</option>';
                            b_hasDefault = true;
                        } else {
                            _selectOption = '<option value="' + result.id + '">' + s_cardName + '</option>';
                        }
                        s_cardOptions += _selectOption;
                        return true;
                    });
                    if (!b_hasDefault) {

                        s_cardOptions = '<option  value="">Choose...</option>' + s_cardOptions;
                    }
                    //log.debug('s_cardOptions - ' + b_hasDefault, s_cardOptions)
                    s_payPageHTML = s_payPageHTML.replace('{{EXISTINGCARDS}}', s_cardOptions);
                    if (s_cardOptions.length > 0) {
                        s_payPageHTML = s_payPageHTML.replace('{{HASCARDS}}', 'show');
                        s_payPageHTML = s_payPageHTML.replace('{{SHOWCARDS}}', '');
                    } else {
                        s_payPageHTML = s_payPageHTML.replace('{{SHOWCARDS}}', 'style="display: none;"');
                    }
                    try {
                        let o_ipInfo = http.get({
                            url: 'http://ip-api.com/json/' + context.request.clientIpAddress + '?fields=city,region'
                        });
                        if (o_ipInfo.code === 200) {
                            let o_data = JSON.parse(o_ipInfo.body);
                            s_payPageHTML = s_payPageHTML.replace('{{ACCESSNOTE}}', 'Accessed from ' + o_data.city + ', ' + o_data.region + '(' + context.request.clientIpAddress + ')');
                        } else {
                            s_payPageHTML = s_payPageHTML.replace('{{ACCESSNOTE}}', '');
                        }
                        //log.debug('o_ipInfo', o_ipInfo.body)
                    }
                    catch (ex)
                    {
                        log.error(ex.name, ex.message);
                        log.error(ex.name, ex.stack);
                        s_payPageHTML = s_payPageHTML.replace('{{ACCESSNOTE}}', '');
                    }

                    s_payPageHTML = s_payPageHTML.replace('{{ENCRYPTED}}', o_allParams.xkcd);
                    s_payPageHTML = s_payPageHTML.replace('{{INVNUM}}', o_invoiceRec.getValue({fieldId: 'tranid'}));
                    s_payPageHTML = s_payPageHTML.replace('{{ECHEX_ON}}', o_config2.custrecord_an_click2pay_enable_echecks.val);

                    //clear the echecks code
                    if (!o_config2.custrecord_an_click2pay_enable_echecks.val) {
                        var regex1 = new RegExp(`xechecks\\b[\\s\\S]*?\\bxechecks`, 'is');
                        s_payPageHTML = s_payPageHTML.replace(regex1, '');
                    }

                    context.response.write(s_payPageHTML);
                    //o_invoiceRec.save({ignoreMandatoryFields: true});

                    let o_updateValues = {}
                    if (!_.isDate(o_invoiceRec.getValue({fieldId: 'custbody_authnet_c2p_most_recent_open'}))) {
                        o_updateValues.custbody_authnet_c2p_most_recent_open =  m_now;
                    }
                    o_updateValues.custbody_authnet_c2p_most_recent_open =  m_now;
                    o_updateValues.custbody_authnet_c2p_number_opens =  o_invoiceRec.getValue({fieldId: 'custbody_authnet_c2p_number_opens'}) + 1;

                    record.submitFields({
                        type : 'invoice',
                        id : recordId,
                        values : o_updateValues,
                        options : {ignoreMandatoryFields:true}
                    });
                    log.audit('Invoice updated with recent view', 'Viewing of the link data was just updated');

                }
                else
                {
                    search.create({
                        type:'transaction',
                        filters : [
                            ['internalid', 'anyof', [recordId]],
                            "AND",
                            ['mainline', 'is', true]
                        ],
                        columns :
                            [
                                'type',
                                'amount',
                                'tranid',
                                'trandate',
                            ]
                    }).run().each(function (result) {
                        //log.debug('result: '+context.request.clientIpAddress, result);
                        context.response.write(renderResultPage({config: o_config2, code:'Paid In Full', message : 'This invoice was paid on '+result.getValue('trandate')+ ' in the amount of $'+result.getValue('amount')}));
                        //context.response.write(JSON.stringify(result));
                        return true;
                    });
                }

            } else if (context.request.method === 'POST'){
                log.audit('POST '+context.request.clientIpAddress, 'New Submission');
                //log.debug(context.request.clientIpAddress, authNetC2P.crypto.decode64(context.request.parameters.kie));
                let s_decodedKie = authNetC2P.crypto.decode64(context.request.parameters.kie);
                let o_decodedKie = {};
                try {
                    o_decodedKie = JSON.parse(s_decodedKie);
                }
                catch (e)
                {
                    log.error('Decode of kie failed', 'kie passed was : '+ s_decodedKie);
                }
                if (_.isEmpty(o_decodedKie))
                {
                    context.response.write(context.request.clientIpAddress +' : interesting parameters were detected and your submission has been logged.');
                }
                else
                {
                    //test for failure o_decodedKie = {"iv":"0F029369B26A294CD09728C958615341","ciphertext":"/v2Q/n+NrLc3DBh61OubMw=="}
                    let recordId;
                    try
                    {
                        recordId = authNetC2P.crypto.decrypt(o_decodedKie, 'custsecret_authnet_payment_link');
                    }
                    catch (e)
                    {
                        log.error('Decrypt FAILED', 'Faield to decrypt :' + JSON.stringify(o_decodedKie));
                    }
                    //log.debug('POST Decrypted recordId', recordId);

                    if (!recordId)
                    {
                        context.response.write(context.request.clientIpAddress +' : A passed value may have been tampered with and is unreadable.');
                    }
                    else
                    {
                        log.audit('STARTING PAYMENT PROCESSING', 'LOADING the invoice and beginig the process!');
                        let o_invoiceRec = record.load({
                            type: 'invoice',
                            id: recordId
                        });
                        //now get authnet config data to build the UI accordingly
                        let o_config2 = authNetC2P.authNet.getCache(o_invoiceRec);
                        //log.debug('POST o_config2', o_config2);
                        if (o_invoiceRec.getValue({fieldId: 'status'}) !== 'Open')
                        {
                            log.audit(context.request.clientIpAddress +' : PAID', 'Displaying paid in full message');
                            search.create({
                                type:'transaction',
                                filters : [
                                    ['appliedtotransaction', 'anyof', [recordId]],
                                ],
                                columns :
                                    [
                                        'type',
                                        'amount',
                                        'tranid',
                                        'trandate',
                                        {name:'internalid', sort:'DESC'}
                                    ]
                            }).run().each(function (result) {
                                //log.debug('result: '+context.request.clientIpAddress, result);
                                context.response.write(renderResultPage({config: o_config2, code:'Paid In Full', message : 'This invoice was paid on '+result.getValue('trandate')+ ' in the amount of $'+o_invoiceRec.getValue({fieldId: 'total'})}));
                                //context.response.write(JSON.stringify(result));
                                return false;
                            });
                            return;
                        }
                        log.audit(context.request.clientIpAddress +' : Payment Screen', 'Building Payment now for INVOICE : '+o_invoiceRec.getValue({fieldId:'tranid'}));
                        let i_entityId = +o_invoiceRec.getValue({fieldId:'entity'});
                        let o_customerDetails = search.lookupFields({type : 'customer', id : i_entityId, columns :['isperson']});
                        let o_totalDue = authNetC2P.paymentlink.invoiceAmountDue(o_invoiceRec);
                        //log.debug('o_customerDetails',o_customerDetails);
                        let i_paymentTokenId = +context.request.parameters.existingmethod;

                        log.audit('Do we have a token to use? (or are we making a new one)', i_paymentTokenId);

                        if (i_paymentTokenId !== 0)
                        {
                            log.audit('Ready to make payment with', 'Existing Method');
                            //context.response.write('Payment with Existing Method<br/>'+i_paymentId);
                        }
                        else if (context.request.parameters['cc-number'] && context.request.parameters['cc-expiration'] && context.request.parameters['cc-cvv'])
                        {

                            log.audit('Tokenizing NEW Card', /^\d+$/.test(context.request.parameters['cc-expiration']));
                            if (!(/^\d+$/.test(context.request.parameters['cc-expiration'])))
                            {
                                log.error('Card Date Format is Invalid', context.request.parameters['cc-expiration']);
                                context.response.write(renderErrorPage({config: o_config2, code:'Invalid Date Format', message : 'Expiration date of '+context.request.parameters['cc-expiration']+ ' is invalid and must be in MMYY format.'}))
                                return;
                            }
                            let dateTest = moment(context.request.parameters['cc-expiration'].toString(), 'MMYY').isBefore(moment().startOf('month'));
                            if (dateTest)
                            {
                                log.error('Card Date is Invalid', context.request.parameters['cc-expiration']);
                                context.response.write(renderErrorPage({config: o_config2, code:'Invalid Card Date', message : 'Expiration date of '+context.request.parameters['cc-expiration']+ ' has passed and this card is expired.'}))
                                return;
                            }
                            log.audit('Tokenizing NEW Card', 'Begining build of new card token');
                            let o_newCard = record.create({
                                type:'customrecord_authnet_tokens',
                                isDynamic : true
                            });
                            o_newCard.setValue({fieldId:'custrecord_an_token_entity', value : i_entityId});
                            if (o_invoiceRec.getValue({fieldId:'subsidiary'}))
                            {
                                let o_payload = {subsidiary : +o_invoiceRec.getValue({fieldId:'subsidiary'})}
                                o_newCard.setValue({fieldId:'custrecord_an_token_click2pay_data', value : JSON.stringify(o_payload)});
                                o_newCard.setValue({fieldId:'custrecord_an_token_subsidiary', value : +o_invoiceRec.getValue({fieldId:'subsidiary'})});
                            }

                            o_newCard.setValue({fieldId:'custrecord_an_token_paymenttype', value : 1});
                            o_newCard.setValue({fieldId:'custpage_customertype', value : o_customerDetails.isperson ? 'individual' : 'business'});
                            //set card data
                            if (!_.isUndefined(context.request.parameters.saveCard))
                            {
                                log.debug('card flexDefault', context.request.parameters.defaultCard === 'on');
                                o_newCard.setValue({fieldId:'custrecord_an_token_default', value : context.request.parameters.defaultCard === 'on'});
                            }
                            o_newCard.setValue({fieldId:'custrecord_an_token_cardnumber', value : context.request.parameters['cc-number']});
                            o_newCard.setValue({fieldId:'custrecord_an_token_expdate', value : context.request.parameters['cc-expiration']});
                            o_newCard.setValue({fieldId:'custrecord_an_token_cardcode', value : context.request.parameters['cc-cvv']});
                            //set address data
                            if (context.request.parameters.email) {
                                o_newCard.setValue({
                                    fieldId: 'custrecord_an_token_entity_email',
                                    value: context.request.parameters.email
                                });
                            }
                            o_newCard.setValue({fieldId:'custrecord_an_token_name_on_card', value : context.request.parameters['cc-firstname']});
                            o_newCard.setValue({fieldId:'custrecord_an_token_lastname_on_card', value : context.request.parameters['cc-lastname']});
                            o_newCard.setValue({fieldId:'custrecord_an_token_entity_addr_number', value : context.request.parameters['address']});
                            o_newCard.setValue({fieldId:'custrecord_an_token_entity_addr_city', value : context.request.parameters['city']});
                            o_newCard.setValue({fieldId:'custrecord_an_token_entity_addr_state', value : context.request.parameters['state']});
                            let a_zipParts = context.request.parameters['zip'].split('-');
                            o_newCard.setValue({fieldId:'custrecord_an_token_entity_addr_zip', value : a_zipParts[0]});
                            if (a_zipParts[1])
                            {
                                o_newCard.setValue({fieldId:'custrecord_an_token_entity_addr_zipplus4', value : a_zipParts[1]});
                            }
                            try
                            {
                                i_paymentTokenId = o_newCard.save({ignoreMandatoryFields: true});
                            }
                            catch (e)
                            {
                                let _error = e.message;
                                _error = _error.substring(0,_error.lastIndexOf('<br>'));
                                context.response.write(renderErrorPage({config: o_config2,code:'Processing Error', message : _error}));
                                return;
                            }
                            log.audit('Ready to make payment with', 'NEW Credit Card');

                        }
                        else if (context.request.parameters.bankaccounttype && context.request.parameters.bankrouting && context.request.parameters.bankaccount )
                        {

                            log.audit('Tokenizing ACH information', 'Creating a new eCheck');
                            let o_newBank = record.create({
                                type:'customrecord_authnet_tokens',
                                isDynamic : true
                            });
                            o_newBank.setValue({fieldId:'custrecord_an_token_entity', value : i_entityId});
                            o_newBank.setValue({fieldId:'custrecord_an_token_paymenttype', value : 2});
                            o_newBank.setValue({fieldId:'custpage_customertype', value : o_customerDetails.isperson ? 'individual' : 'business'});
                            if (!_.isUndefined(context.request.parameters.saveBank))
                            {
                                o_newBank.setValue({fieldId:'custrecord_an_token_default', value : context.request.parameters.defaultBank === 'on'});
                            }
                            //set account data
                            if (context.request.parameters.email) {
                                o_newBank.setValue({
                                    fieldId: 'custrecord_an_token_entity_email',
                                    value: context.request.parameters.email
                                });
                            }
                            o_newBank.setValue({fieldId:'custrecord_an_token_bank_bankname', value : context.request.parameters['bankname']});
                            o_newBank.setValue({fieldId:'custrecord_an_token_bank_routingnumber', value : context.request.parameters['bankrouting']});
                            o_newBank.setValue({fieldId:'custrecord_an_token_bank_accountnumber', value : context.request.parameters['bankaccount']});
                            o_newBank.setValue({fieldId:'custrecord_an_token_bank_nameonaccount', value : context.request.parameters['accountname']});
                            //ach type information
                            let a_achParts = context.request.parameters['bankaccounttype'].split('-');
                            o_newBank.setValue({fieldId:'custpage_achtype', value : a_achParts[0]});
                            o_newBank.setValue({fieldId:'custpage_banktype', value : a_achParts[1]});

                            try
                            {
                                i_paymentTokenId = o_newBank.save({ignoreMandatoryFields:true});
                            }
                            catch (e)
                            {
                                let _error = e.message;
                                _error = _error.substring(0,_error.lastIndexOf('<br>'));
                                context.response.write(renderErrorPage({config: o_config2, code:'Processing Error', message : _error}));
                                return;
                            }
                            log.audit('Ready to make payment with',  'NEW Bank Account');
                        }
                        else
                        {
                            log.error('Nothing useful submitted', 'So, redirect back to the OG page I guess');
                            redirect.redirect({
                                url: authNetC2P.paymentlink.serviceUrl(),
                                parameters: {
                                    'xkcd':context.request.parameters.kie
                                }
                            });
                        }
                        let i_payment;
                        if (i_paymentTokenId)
                        {
                            log.audit('Using Token to build Payment', 'New Payment being created');
                            try {
                                let o_payment = record.transform({
                                    fromType : record.Type.INVOICE,
                                    fromId : recordId,
                                    toType: record.Type.CUSTOMER_PAYMENT,
                                    isDynamic: true,
                                });
                                o_payment.setValue({fieldId: 'custbody_authnet_use', value: true});
                                o_payment.setValue({fieldId: 'undepfunds', value: 'T'});
                                o_payment.setValue({fieldId: 'memo', value: 'Customer Generated via Click2Pay Link'});
                                o_payment.setValue({fieldId: 'payment', value: o_totalDue.asNumber});
                                o_payment.setValue({fieldId: 'custbody_authnet_cim_token', value: i_paymentTokenId});
                                i_payment = o_payment.save({ignoreMandatoryFields: true});
                                if (!context.request.parameters.existingmethod && _.isUndefined(context.request.parameters.saveCard) && _.isUndefined(context.request.parameters.saveBank)) {
                                    //done with load and save to prevent tampering flag!
                                    let o_newCard = record.load({
                                        type: 'customrecord_authnet_tokens',
                                        id: i_paymentTokenId,
                                        isDynamic: true
                                    });
                                    o_newCard.setValue({fieldId: 'isinactive', value: true});
                                    o_newCard.save({ignoreMandatoryFields:true});
                                }


                            }
                            catch (ex)
                            {
                                log.error(ex.name, ex.message);
                                log.error(ex.name, ex.stack);
                                context.response.write(renderErrorPage({config: o_config2, code:'Processing Error', message : 'There was an error while attempting to generate this payment unrealted to your inputs.<br/> If this persists, please contact AR for assistance.'}));
                                return;
                            }
                            if(i_payment) {
                                //search for the payment ID - it could have been deleted.
                                let sea_payment = search.create({
                                    type: 'customerpayment',
                                    filters: [
                                        ['internalid', 'anyof', [i_payment]],
                                        "AND",
                                        ['mainline', 'is', true]
                                    ],
                                    columns:
                                        []
                                }).run();
                                i_payment = null;
                                sea_payment.each(function (result)
                                {
                                    i_payment = result.id;
                                    return false;
                                });
                            }
                            if(i_payment) {
                                log.audit('Payment was Successful', 'Rendering Success page!');
                                let o_completedPayment = record.load({
                                    type: record.Type.CUSTOMER_PAYMENT,
                                    id: i_payment
                                });
                                context.response.write(renderResultPage({
                                    config: o_config2,
                                    code: 'Successfully Paid',
                                    message: 'Thank you for your payment of $' + o_totalDue.asCurrency + '<br>The payment ID for your records is ' + o_completedPayment.getValue({fieldId: 'tranid'}) + ' (' + o_completedPayment.getValue({fieldId: 'custbody_authnet_refid'}) + ')' +
                                        '<p class="h4">(You may close this browser tab now)</p>'
                                }));
                            }
                            else
                            {
                                let o_error = {
                                    config: o_config2,
                                    code:'Error',
                                    message : 'Payment Failure'
                                };
                                search.create({
                                    type: 'customrecord_authnet_history',
                                    filters: [
                                        ['custrecord_an_customer', 'anyof', [o_invoiceRec.getValue({fieldId:'entity'})]],
                                        "AND",
                                        ['custrecord_an_response_status', 'is', 'Error'],
                                        "AND",
                                        ['custrecord_an_call_type', 'is', 'authCaptureTransaction'],
                                        "AND",
                                        ['custrecord_an_calledby', 'is', 'customerpayment'],
                                    ],
                                    columns:
                                        [
                                            {name:'internalid', sort:'DESC'},
                                            'custrecord_an_response_message',
                                            'custrecord_an_refid',
                                            'custrecord_an_response_code_type'
                                        ]
                                }).run().each(function (result)
                                {
                                    log.debug('result', result)
                                    o_error.code = result.getValue('custrecord_an_response_code_type');
                                    o_error.message = result.getValue('custrecord_an_response_message') + ' (' + result.getValue('custrecord_an_refid') + ')'

                                    return false;
                                });
                                log.audit('Payment was NOT Successful', 'Rendering FAILURE : '+o_error.message);
                                context.response.write(renderErrorPage(o_error));
                            }
                        }
                        else
                        {
                            log.audit('Payment was NOT Successful', 'Rendering General FAILURE');
                            context.response.write(renderErrorPage({config: o_config2, code:'NOT PAID', message : 'A payment was not generated - this invoice remains unpaid'}));
                        }

                    }
                }
            }
        }

        exports.onRequest = onRequest;
        return exports;
    });
