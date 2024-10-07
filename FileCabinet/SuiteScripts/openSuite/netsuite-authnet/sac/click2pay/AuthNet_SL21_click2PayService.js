/**
 * Module Description...
 *
 * @exports XXX
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
 */
define(['N/record', 'N/ui/serverWidget', 'N/http', 'N/compress', 'N/crypto', 'N/error', 'N/file', 'N/runtime', 'N/url', 'N/encode', 'N/search', 'N/redirect', 'N/format','../lib/lodash.min', '../lib/moment.min', '../lib/LLC_lib21'],
    function (record, serverWidget, http, compress, crypto, error, file, runtime, url, encode, search, redirect, format, _, moment, LLC) {

        const exports = {};
        function renderErrorPage(o_error)
        {
            let errorPageHTML = file.load('SuiteScripts/c9/html/onlinepayment_error.html');
            let s_contents = errorPageHTML.getContents();
            s_contents = s_contents.replace('{{CODE}}', o_error.code);
            s_contents = s_contents.replace('{{MESSAGE}}', o_error.message);
            return s_contents;
        }
        function renderResultPage(o_error)
        {
            let errorPageHTML = file.load('SuiteScripts/c9/html/onlinepayment_result.html');
            let s_contents = errorPageHTML.getContents();
            s_contents = s_contents.replace('{{CODE}}', o_error.code);
            s_contents = s_contents.replace('{{MESSAGE}}', o_error.message);
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
                //var o_accessingUser = runtime.getCurrentUser();
                //log.debug('USER', runtime.getCurrentUser());
                if (!_.isEmpty(context.request.parameters._fid) && context.request.parameters.fl === 'true') {
                    try {
                        let o_fieldIDpayload = JSON.parse(LLC.crypto.decode64(o_allParams._fid));
                        let fileId =  LLC.crypto.decrypt(o_fieldIDpayload, 'custsecret_authnet_payment_link');
                        let fileObject = file.load({
                            id: fileId
                        });
                        log.debug('file type ' + fileObject.fileType, fileObject.name.slice((fileObject.name.lastIndexOf(".") - 1 >>> 0) + 2))
                        //fileObject.name.slice((fileObject.name.lastIndexOf(".") - 1 >>> 0) + 2)
                        let s_downloadName = fileObject.name;
                        if (!(s_downloadName.slice((s_downloadName.lastIndexOf(".") - 1 >>> 0) + 2))) {
                            switch (_.toUpper(fileObject.fileType)) {
                                case 'EXCEL':
                                    //s_contentType = 'application/vnd.ms-excel';
                                    if (!_.endsWith(fileObject.name, '.xls') || !_.endsWith(fileObject.name, '.xls')) {
                                        s_downloadName += '.xls';
                                    }
                                    context.response.addHeader({
                                        name: 'Content-Disposition',
                                        value: 'inline; filename=' + fileObject.name + '.xls'
                                    });
                                    break;
                                case 'CSV':
                                    //s_contentType = 'application/vnd.ms-excel';
                                    if (!_.endsWith(fileObject.name, '.csv') || !_.endsWith(fileObject.name, '.csv')) {
                                        s_downloadName += '.csv';
                                    }
                                    break;
                                case 'PDF':
                                    //s_contentType = 'application/vnd.ms-excel';
                                    if (!_.endsWith(fileObject.name, '.pdf')) {
                                        s_downloadName += '.pdf';
                                    }
                                    break;
                                case 'WORD':
                                    //s_contentType = 'application/vnd.ms-excel';
                                    if (!_.endsWith(fileObject.name, '.doc') || !_.endsWith(fileObject.name, '.docx')) {
                                        s_downloadName += '.doc';
                                    }
                                    break;
                                default:
                                    break;
                            }
                        }
                        context.response.writeFile({file: fileObject, isinline: true});
                    }
                    catch (e)
                    {
                        log.error(e.name, e.message);
                        log.error(e.name, e.stack);
                        context.response.write(renderResultPage({code:'404 : File Not Found', message : 'The file you are attempting to download was not found or there was an issue accessing it.'}));
                    }
                    return;
                }
                else if (!_.isEmpty(context.request.parameters._cid))
                {
                    let o_payload = JSON.parse(LLC.crypto.decode64(o_allParams._cid));
                    //log.debug('o_payload', o_payload);
                    let recordId =  LLC.crypto.decrypt(o_payload, 'custsecret_authnet_payment_link');
                    if (!recordId)
                    {
                        log.error('Unable to decrypt xkcd', 'Value failed to decrypt so we can not proceed');
                        context.response.write(renderResultPage({code:'404 : File Not Found', message : 'The files you are attempting to download were not found or there was an issue accessing it.'}));
                        return;
                    }
                    let o_invoiceRec = record.load({
                        type : 'customrecord_llc_accn_consolidated_invoi',
                        id : recordId
                    });
                    //build the archiver to zip up the files
                    let archiver = compress.createArchiver();
                    //get all the CSV files and zip them up
                    _.forEach([
                        'custrecordconsolidated_invoice_csv',
                        'custrecord_invoice_csv_two',
                        'custrecord_invoice_csv_three',
                        'custrecord_invoice_csv_four',
                        'custrecord_invoice_csv_five',
                    ], function(fieldId){
                        if (o_invoiceRec.getValue({fieldId: fieldId}))
                        {
                            let  _fileObject = file.load({
                                id: o_invoiceRec.getValue({fieldId: fieldId})
                            });
                            archiver.add({
                                file: _fileObject
                            });
                        }
                    });

                    let zipFile = archiver.archive({
                        name: o_invoiceRec.getValue({fieldId:'name'})+'.zip'
                    });
                    context.response.writeFile({file: zipFile, isinline: true});
                    return;
                }
                else if (!o_allParams.xkcd)
                {
                    log.error('UNDEFINED REQUEST - no element', context.request.clientIpAddress)
                    context.response.write('200 : OK logged from '+context.request.clientIpAddress);
                    return;
                }
                //decrypt the id for the record
                let o_payload = JSON.parse(LLC.crypto.decode64(o_allParams.xkcd));
                //log.debug('o_payload', o_payload);
                let recordId =  LLC.crypto.decrypt(o_payload, 'custsecret_authnet_payment_link');
                log.debug('GET Decrypted recordId', recordId);
                if (!recordId)
                {
                    log.error('Unable to decrypt xkcd', 'Value failed to decrypt so we can not proceed');
                    context.response.write(context.request.clientIpAddress +' : requested a value may have been tampered with and is unreadable.');
                    return;
                }
                let o_invoiceRec = record.load({
                    type : 'customrecord_llc_accn_consolidated_invoi',
                    id : recordId
                });

                if (!o_invoiceRec.getValue({fieldId: 'custrecord_paylink_payment'})) {
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
                    if (!_.isDate(o_invoiceRec.getValue({fieldId: 'custrecord_paylink_first_open'}))) {
                        o_invoiceRec.setValue({fieldId: 'custrecord_paylink_first_open', value: m_now});
                    }
                    o_invoiceRec.setValue({fieldId: 'custrecord_paylink_most_recent_open', value: m_now});
                    o_invoiceRec.setValue({
                        fieldId: 'custrecord_paylink_number_opens',
                        value: o_invoiceRec.getValue({fieldId: 'custrecord_paylink_number_opens'}) + 1
                    });

                    //lookup the total of open invoices off this record
                    let o_totalDue = LLC.paymentlink.consolidatedInvoiceAmountDue(recordId);
                    log.debug('o_totalDue', o_totalDue)
                    if (+o_totalDue.asNumber === 0)
                    {
                        context.response.write(renderResultPage({code:'Paid In Full', message : 'This invoice has already been paid in full - Thank you'}));
                        //context.response.write('This invoice has already been paid in full - Thank you');
                        return;
                    }
                    let suiteletURL = LLC.paymentlink.serviceUrl();
                    let payPageHTML = file.load('SuiteScripts/c9/html/onlinepayment_index.html');
                    let s_payPageHTML = payPageHTML.getContents();
                    s_payPageHTML = s_payPageHTML.replace('{{FORMLINK}}', suiteletURL);
                    s_payPageHTML = s_payPageHTML.replace('{{BALANCE}}', o_totalDue.asCurrency);
                    let s_pdfLink = '';
                    if (o_invoiceRec.getValue({fieldId: 'custrecord_consolidated_invoice_pdf'}))
                    {
                        let o_encryptedPDFId = LLC.crypto.encrypt(o_invoiceRec.getValue({fieldId: 'custrecord_consolidated_invoice_pdf'}), 'custsecret_authnet_payment_link');
                        s_pdfLink = suiteletURL + '&_fid=' + LLC.crypto.encode64(JSON.stringify(o_encryptedPDFId)) + '&fl=true';
                        if (s_pdfLink)
                        {
                            s_pdfLink = '<p><a target="_blank" href="'+s_pdfLink+'">Download Invoice PDF</a></p>'
                        }
                    }
                    //how many CSV's do we have?
                    let i_csvCount = 0;
                    _.forEach([
                        'custrecordconsolidated_invoice_csv',
                        'custrecord_invoice_csv_two',
                        'custrecord_invoice_csv_three',
                        'custrecord_invoice_csv_four',
                        'custrecord_invoice_csv_five',
                    ], function(fieldId){
                        if (o_invoiceRec.getValue({fieldId: fieldId}))
                        {
                            i_csvCount++;
                        }
                    });
                    let s_csvLink = '';
                    if (i_csvCount === 1){
                        let o_encryptedCSVID = LLC.crypto.encrypt(o_invoiceRec.getValue({fieldId: 'custrecordconsolidated_invoice_csv'}), 'custsecret_authnet_payment_link');
                        let s_csvLinkData = (o_invoiceRec.getValue({fieldId: 'custrecordconsolidated_invoice_csv'})) ? suiteletURL + '&_fid=' + LLC.crypto.encode64(JSON.stringify(o_encryptedCSVID)) + '&fl=true' : '';
                        s_csvLink = '<p><a target="_blank" href="'+s_csvLinkData+'">Download Invoice CSV</a></p>';
                    }
                    else if (i_csvCount > 1)
                    {
                        let o_encrypted_cid = LLC.crypto.encrypt(o_invoiceRec.id, 'custsecret_authnet_payment_link');
                        let s_csvZipLink = suiteletURL + '&_cid=' + LLC.crypto.encode64(JSON.stringify(o_encrypted_cid));
                        s_csvLink = '<p><a target="_blank" href="'+s_csvZipLink+'">Download Invoice CSV (zip)</a></p>';
                    }
                    s_payPageHTML = s_payPageHTML.replace('{{CONSOLDPDF}}', s_pdfLink);
                    s_payPageHTML = s_payPageHTML.replace('{{CONSOLDCSV}}', s_csvLink);
                    //now lookup the validation.js file URL and embed it into the form
                    search.create({
                        type: 'file',
                        filters: [
                            ['name', 'is', 'onlinepayment_vaildation.js'],
                        ],
                        columns:
                            [
                                'url',
                            ]
                    }).run().each(function (result)
                    {
                        s_payPageHTML = s_payPageHTML.replace('{{VALIDATION_SCRIPT}}', result.getValue('url'));
                        return true;
                    });
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
                            ['internalid', 'anyof', [o_invoiceRec.getValue({fieldId: 'custrecord_consolidatedcustomer'})]],
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
                        log.debug('billing lookup results', result)
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
                            ['custrecord_an_token_entity', 'anyof', [o_invoiceRec.getValue({fieldId: 'custrecord_consolidatedcustomer'})]],
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
                        let _selectOption = ''
                        if (result.getValue('custrecord_an_token_default')) {
                            _selectOption = '<option selected="" value="' + result.id + '">' + result.getValue('name') + '</option>';
                            b_hasDefault = true;
                        } else {
                            _selectOption = '<option value="' + result.id + '">' + result.getValue('name') + '</option>';
                        }
                        s_cardOptions += _selectOption;
                        return true;
                    });
                    if (!b_hasDefault) {
                        s_cardOptions = '<option  value="">Choose...</option>' + s_cardOptions;
                    }
                    log.debug('s_cardOptions - ' + b_hasDefault, s_cardOptions)
                    s_payPageHTML = s_payPageHTML.replace('{{EXISTINGCARDS}}', s_cardOptions);
                    if (s_cardOptions.length > 0) {
                        s_payPageHTML = s_payPageHTML.replace('{{HASCARDS}}', 'show');
                        s_payPageHTML = s_payPageHTML.replace('{{SHOWCARDS}}', '');
                    } else {
                        s_payPageHTML = s_payPageHTML.replace('{{SHOWCARDS}}', 'style="display: none;"');
                    }
                    let o_ipInfo = http.get({
                        url: 'http://ip-api.com/json/' + context.request.clientIpAddress + '?fields=city,region'
                    });
                    if (o_ipInfo.code === 200) {
                        let o_data = JSON.parse(o_ipInfo.body);
                        s_payPageHTML = s_payPageHTML.replace('{{ACCESSNOTE}}', 'Accessed from ' + o_data.city + ', ' + o_data.region + '(' + context.request.clientIpAddress + ')');
                    } else {
                        s_payPageHTML = s_payPageHTML.replace('{{ACCESSNOTE}}', '');
                    }
                    log.debug('o_ipInfo', o_ipInfo.body)
                    s_payPageHTML = s_payPageHTML.replace('{{ENCRYPTED}}', o_allParams.xkcd);
                    context.response.write(s_payPageHTML);
                    o_invoiceRec.save({ignoreMandatoryFields: true});
                }
                else
                {
                    search.create({
                        type:'transaction',
                        filters : [
                            ['internalid', 'anyof', [o_invoiceRec.getValue({fieldId: 'custrecord_paylink_payment'})]],
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
                        context.response.write(renderResultPage({code:'Paid In Full', message : 'This invoice was paid on '+result.getValue('trandate')+ ' in the amount of $'+result.getValue('amount')}));
                        //context.response.write(JSON.stringify(result));
                        return true;
                    });
                }

            } else if (context.request.method === 'POST'){
                log.debug('POST '+context.request.clientIpAddress, context.request.parameters);
                //return;
                //log.debug(context.request.clientIpAddress, LLC.crypto.decode64(context.request.parameters.kie));
                let s_decodedKie = LLC.crypto.decode64(context.request.parameters.kie);
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
                        recordId = LLC.crypto.decrypt(o_decodedKie, 'custsecret_authnet_payment_link');
                    }
                    catch (e)
                    {
                        log.error('Decrypt FAILED', 'Faield to decrypt :' + JSON.stringify(o_decodedKie));
                    }
                    log.debug('POST Decrypted recordId', recordId);

                    if (!recordId)
                    {
                        context.response.write(context.request.clientIpAddress +' : A passed value may have been tampered with and is unreadable.');
                    }
                    else
                    {
                        let o_invoiceRec = record.load({
                            type: 'customrecord_llc_accn_consolidated_invoi',
                            id: recordId
                        });
                        if (o_invoiceRec.getValue({fieldId:'custrecord_paylink_payment'}))
                        {
                            log.audit(context.request.clientIpAddress +' : PAID', 'Displaying paid in full message');
                            context.response.write('This invoices has already been paid in full, please contact AR if you feel this is an error.');
                            return;
                        }
                        log.audit(context.request.clientIpAddress +' : Payment Screen', 'Building Payment Page now');
                        let i_entityId = +o_invoiceRec.getValue({fieldId:'custrecord_consolidatedcustomer'});
                        let o_customerDetails = search.lookupFields({type : 'customer', id : i_entityId, columns :['isperson']});
                        let o_totalDue = LLC.paymentlink.consolidatedInvoiceAmountDue(recordId);
                        //log.debug('o_customerDetails',o_customerDetails);
                        let i_paymentTokenId = +context.request.parameters.existingmethod;
                        if (i_paymentTokenId !== 0)
                        {
                            log.audit('Generating Payment with Existing Method');
                            //context.response.write('Payment with Existing Method<br/>'+i_paymentId);
                        }
                        else if (context.request.parameters['cc-number'] && context.request.parameters['cc-expiration'] && context.request.parameters['cc-cvv'])
                        {

                            log.audit('Tokenizing NEW Card', /^\d+$/.test(context.request.parameters['cc-expiration']));
                            if (!(/^\d+$/.test(context.request.parameters['cc-expiration'])))
                            {
                                context.response.write(renderErrorPage({code:'Invalid Date Format', message : 'Expiration date of '+context.request.parameters['cc-expiration']+ ' is invalid and must be in MMYY format.'}))
                                return;
                            }
                            if (moment(context.request.parameters['cc-expiration'], 'MMYY').isBefore(moment()))
                            {
                                context.response.write(renderErrorPage({code:'Invalid Card Date', message : 'Expiration date of '+context.request.parameters['cc-expiration']+ ' has passed and this card is expired.'}))
                                return;
                            }
                            let o_newCard = record.create({
                                type:'customrecord_authnet_tokens',
                                isDynamic : true
                            });
                            o_newCard.setValue({fieldId:'custrecord_an_token_entity', value : i_entityId});
                            o_newCard.setValue({fieldId:'custrecord_an_token_paymenttype', value : 1});
                            o_newCard.setValue({fieldId:'custpage_customertype', value : o_customerDetails.isperson ? 'individual' : 'business'});
                            //set card data
                            o_newCard.setValue({fieldId:'custrecord_an_token_default', value : context.request.parameters.flexDefault === 'default'});
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
                            try {
                                i_paymentTokenId = o_newCard.save({ignoreMandatoryFields: true});
                            }
                            catch (e)
                            {
                                let _error = e.message;
                                _error = _error.substring(0,_error.lastIndexOf('<br>'));
                                context.response.write(renderErrorPage({code:'Processing Error', message : _error}));
                                return;
                            }
                            log.audit('Generating Payment with NEW Credit Card');
                            //context.response.write('Generating Payment with NEW Credit Card<br/>'+context.request.body);
                        }
                        else if (context.request.parameters.bankaccounttype && context.request.parameters.bankrouting && context.request.parameters.bankaccount )
                        {

                            log.audit('Tokenizing ACH information');
                            let o_newBank = record.create({
                                type:'customrecord_authnet_tokens',
                                isDynamic : true
                            });
                            o_newBank.setValue({fieldId:'custrecord_an_token_entity', value : i_entityId});
                            o_newBank.setValue({fieldId:'custrecord_an_token_paymenttype', value : 2});
                            o_newBank.setValue({fieldId:'custpage_customertype', value : o_customerDetails.isperson ? 'individual' : 'business'});
                            o_newBank.setValue({fieldId:'custrecord_an_token_default', value : context.request.parameters.flexDefault === 'default'});
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

                            try {
                                i_paymentTokenId = o_newBank.save({ignoreMandatoryFields:true});
                            }
                            catch (e)
                            {
                                let _error = e.message;
                                _error = _error.substring(0,_error.lastIndexOf('<br>'));
                                context.response.write(renderErrorPage({code:'Processing Error', message : _error}));
                                return;
                            }
                            log.audit('Generating Payment with NEW Bank Account');
                        }
                        else
                        {
                            log.error('Nothing useful submitted', 'So, redirect back to the OG page I guess');
                            redirect.redirect({
                                url: LLC.paymentlink.serviceUrl(),
                                parameters: {
                                    'xkcd':context.request.parameters.kie
                                }
                            });
                        }
                        if (i_paymentTokenId)
                        {
                            try {
                                let o_payment = record.create({
                                    type: record.Type.CUSTOMER_PAYMENT,
                                    isDynamic: true,
                                    entity: i_entityId
                                });
                                //should not have to set this next line but you do - something broken in the init
                                o_payment.setValue({fieldId: 'customer', value: i_entityId});
                                o_payment.setValue({fieldId: 'custbody_authnet_use', value: true});
                                o_payment.setValue({fieldId: 'undepfunds', value: 'T'});
                                o_payment.setValue({fieldId: 'memo', value: 'Customer Generated via Payment Link'});
                                o_payment.setValue({fieldId: 'custbody_llc_accn_cons_inv_payment', value: recordId});
                                o_payment.setValue({fieldId: 'payment', value: o_totalDue.asNumber});
                                //o_payment.setValue({fieldId: 'payment', value :  moment().format('M.DD') });
                                o_payment.setValue({fieldId: 'custbody_authnet_cim_token', value: i_paymentTokenId});
                                let i_paymentId = o_payment.save({ignoreMandatoryFields: true});
                                o_invoiceRec.setValue({fieldId: 'custrecord_paylink_payment', value: i_paymentId});
                                o_invoiceRec.save({ignoreMandatoryFields: true});
                                if (!context.request.parameters.saveCard && !context.request.parameters.saveBank) {
                                    //done with load and save to prevent tampering flag!
                                    let o_newCard = record.load({
                                        type: 'customrecord_authnet_tokens',
                                        id: i_paymentTokenId,
                                        isDynamic: true
                                    });
                                    o_newCard.setValue({fieldId: 'isinactive', value: true});
                                    o_newCard.save();
                                }
                            }
                            catch (ex)
                            {
                                log.error(ex.name, ex.message);
                                log.error(ex.name, ex.stack);
                                context.response.write(renderErrorPage({code:'Processing Error', message : 'There was an error while attempting to generate this payment unrealted to your inputs.<br/> If this persists, please contact AR for assistance.'}));
                                return;
                            }
                            //context.response.write('PAID $'+moment().format('M.DD') + ' (that\'s todays date for testing)');
                            context.response.write(renderResultPage({code:'Successfully Paid', message : 'Thank you for your payment of $'+o_totalDue.asCurrency}));
                        }
                        else
                        {
                            context.response.write(renderErrorPage({code:'NOT PAID', message : 'A payment was not generated - this invoice remains unpaid'}));
                        }

                    }




                }
                /*_.forEach(_.keys(context.request), function(kie){
                    log.debug('POST context.request.'+kie, context.request[kie]);
                });*/

                //log.debug('context.request.headers.referer', context.request.headers.referer)

            }
        }

        exports.onRequest = onRequest;
        return exports;
    });
