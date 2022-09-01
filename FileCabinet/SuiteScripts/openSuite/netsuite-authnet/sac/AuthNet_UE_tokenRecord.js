/**
 * Module Description...
 *
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
 * IN NO EVENT SHALL CLOUD 1001, LLC, LLC BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL,
 * OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION,
 * EVEN IF CLOUD 1001, LLC HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * CLOUD 1001, LLC SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
 * THE SOFTWARE AND ACCOMPANYING DOCUMENTATION, IF ANY, PROVIDED HEREUNDER IS PROVIDED "AS IS".
 * CLOUD 1001, LLC HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
 *
 *
 * @author Andy Prior andy@gocloud1001.com
 * @author Cloud 1001, LLC <suiteauthconnect@gocloud1001.com>
 *
 * @NApiVersion 2.0
 * @NModuleScope Public
 * @NScriptType UserEventScript
 *
 * @NAmdConfig ../config.json
 */


define(['N/record', 'N/encode', 'N/runtime', 'N/search', 'N/url', 'N/crypto', 'N/error', 'N/ui/serverWidget', 'N/ui/message', 'lodash', './AuthNet_lib'],
    function (record, encode, runtime, search,  url, crypto, error, ui, message, _, authNet) {


        function setCCDisplay(context){
            if (context.type === 'create'){
                _.forEach([
                    'custrecord_an_token_bank_accounttype',
                    'custrecord_an_token_bank_routingnumber',
                    'custrecord_an_token_bank_accountnumber',
                    'custrecord_an_token_bank_nameonaccount',
                    'custrecord_an_token_bank_bankname',
                    'custrecord_an_token_bank_echecktype',
                    'custrecord_an_token_last4',
                    'custrecord_an_token_type',
                    'custrecord_an_token_token',
                    'custrecord_an_token_customerid',
                    'name',
                    //'custrecord_an_token_pblkchn',
                    'custrecord_an_token_pblkchn_tampered',
                ], function(fldName){
                    context.form.getField({id: fldName}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                });
            }
            else
            {
                _.forEach([
                    'custrecord_an_token_cardnumber',
                    'custrecord_an_token_name_on_card',
                    'custrecord_an_token_cardcode',
                    'custrecord_an_token_bank_accounttype',
                    'custrecord_an_token_bank_routingnumber',
                    'custrecord_an_token_bank_accountnumber',
                    'custrecord_an_token_bank_nameonaccount',
                    'custrecord_an_token_bank_bankname',
                    'custrecord_an_token_bank_echecktype',
                    //'custrecord_an_token_pblkchn',
                ], function(fldName){
                    context.form.getField({id: fldName}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                });

                context.form.getField({id: 'custrecord_an_token_paymenttype'}).updateDisplayType({
                    displayType: ui.FieldDisplayType.DISABLED
                });


            }
        }

        function setACHDisplay(context){
            if (context.type === 'create'){
                _.forEach([
                    'custrecord_an_token_bank_accounttype',
                    'custrecord_an_token_bank_routingnumber',
                    'custrecord_an_token_bank_accountnumber',
                    'custrecord_an_token_bank_nameonaccount',
                    'custrecord_an_token_bank_bankname',
                    'custrecord_an_token_bank_echecktype',
                    'custrecord_an_token_last4',
                    'custrecord_an_token_type',
                    'custrecord_an_token_token',
                    'custrecord_an_token_customerid',
                    'name',
                    //'custrecord_an_token_pblkchn',
                    'custrecord_an_token_pblkchn_tampered',
                ], function(fldName){
                    context.form.getField({id: fldName}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                });
            }
            else
            {
                _.forEach([
                    'custrecord_an_token_cardcode',
                    'custrecord_an_token_customer_type',
                    'custrecord_an_token_expdate',
                    'custrecord_an_token_bank_accountnumber',
                    'custrecord_an_token_cardnumber',
                    //'custrecord_an_token_pblkchn',
                ], function(fldName){
                    context.form.getField({id: fldName}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                });

                context.form.getField({id: 'custrecord_an_token_paymenttype'}).updateDisplayType({
                    displayType: ui.FieldDisplayType.DISABLED
                });


            }
        }

        function beforeLoad(context) {
            //when loading validate the hash and throw an alert if it's invalid
            log.debug(runtime.executionContext, context.type)
            if (runtime.executionContext === runtime.ContextType.USER_INTERFACE ) {
                if (context.request.parameters.entity)
                {
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_entity', value : context.request.parameters.entity})
                }
                if (context.request.parameters.customer)
                {
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_entity', value : context.request.parameters.customer})
                }

                if (context.type === 'create' && (!context.request.parameters.entity && !context.newRecord.getValue({fieldId: 'custrecord_an_token_entity'})))
                {
                    throw 'You can not generate a profile / token without a customer.  Either select a customer record and create a Authorize.Net Customer Payment Profile from there, or enter one from a transaction.';
                }
                if (!_.includes(['delete', 'create'], context.type)) {
                    if (context.newRecord.getValue({fieldId: 'custrecord_an_token_pblkchn_tampered'}) || (authNet.mkpblkchain(context.newRecord, context.newRecord.id) !== context.newRecord.getValue({fieldId: 'custrecord_an_token_pblkchn'}))) {
                        log.error('hash mismatch!', context.newRecord.getValue({fieldId: 'custrecord_an_token_pblkchn'}))
                        context.form.addPageInitMessage({
                            type: message.Type.ERROR,
                            title: 'This Payment Profile has been tampered with',
                            message: 'It will no longer function in NetSuite until a new transaction has used the card data again and the profile is validated as good off actual card data.<br />To see who may have tampered with this record view the System Notes below.',
                            //duration: 5000
                        });
                        context.form.removeButton({id: 'edit'});
                        record.submitFields({
                            type: context.newRecord.type,
                            id: context.newRecord.id,
                            values: {
                                custrecord_an_token_pblkchn_tampered: true,
                                isinactive : true
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });
                    }
                }

                var iseCheck = +context.newRecord.getValue({fieldId: 'custrecord_an_token_paymenttype'}) === 2;
                if (context.type === 'create' && (context.request.parameters.entity || context.request.parameters.pi || context.request.parameters.customer)) {
                    log.debug('making fields viewable');
                    var i_entity =  (context.request.parameters.entity) ? context.request.parameters.entity : (context.request.parameters.pi ? context.request.parameters.pi : context.request.parameters.customer);
                    log.debug('i_entity',i_entity)

                    context.newRecord.setValue({fieldId:'custrecord_an_token_entity', value: i_entity});
                    context.form.getField({id: 'custrecord_an_token_entity'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.INLINE
                    });
                    context.form.getField({id: 'custrecord_an_token_gateway'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.INLINE
                    });

                    var o_config2 = authNet.getConfigFromCache();
                    context.newRecord.setValue({fieldId:'custrecord_an_token_gateway', value: o_config2.id});

                    context.form.getField({id: 'name'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    context.form.getField({id: 'isinactive'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    context.form.getField({id: 'custrecord_an_token_pblkchn_tampered'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    context.form.getField({id: 'custrecord_an_token_pblkchn'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });

                    var o_customerData = search.lookupFields({
                        type : 'customer',
                        id : i_entity,//context.newRecord.getValue({fieldId:'custrecord_an_token_entity'}),
                        columns : [
                            'email',
                            'isperson',
                            'firstname',
                            'lastname',
                            'companyname',
                            'billaddress1',
                            'billaddress2',
                            'billcity',
                            'billzipcode',
                            'billstate',
                            'billcountry',
                            'billcountrycode',
                        ]
                    });
                    //{"email":"test@test2.com","isperson":true,"firstname":"Test","lastname":"NAME","companyname":"Test 3-","billaddress1":"123 Fraud Street","billaddress2":"Aprt Code A","billcity":"Indianapolis","billzipcode":"46201","billstate":[{"value":"IN","text":"IN"}],"billcountry":[{"value":"US","text":"United States"}],"billcountrycode":"US"}
                    if (o_customerData.email){
                        context.newRecord.setValue({fieldId: 'custrecord_an_token_entity_email', value : o_customerData.email});
                    }
                    if (o_customerData.isperson){
                        context.newRecord.setValue({fieldId: 'custrecord_an_token_customer_type', value : 'individual'});
                        var guessedName='';
                        if (o_customerData.firstname)
                        {
                            guessedName += o_customerData.firstname;
                        }
                        if (o_customerData.lastname)
                        {
                            guessedName += ' ' + o_customerData.lastname;
                        }
                        log.debug('guessedName',guessedName)
                        context.newRecord.setValue({fieldId: 'custrecord_an_token_bank_nameonaccount', value : guessedName});
                        context.newRecord.setValue({fieldId: 'custrecord_an_token_name_on_card', value : guessedName});
                    }
                    else
                    {
                        context.newRecord.setValue({fieldId: 'custrecord_an_token_customer_type', value : 'business'});
                    }

                    //add the fake dropdown fields
                    var fld_bankType = context.form.addField({id:'custpage_banktype', type:ui.FieldType.SELECT, label : context.form.getField({id:'custrecord_an_token_bank_accounttype'}).label})
                    fld_bankType.addSelectOption({
                        value : '',
                        text : ''
                    });
                    fld_bankType.addSelectOption({
                        value : 'checking',
                        text : 'Checking'
                    });
                    fld_bankType.addSelectOption({
                        value : 'savings',
                        text : 'Savings'
                    });
                    fld_bankType.addSelectOption({
                        value : 'businessChecking',
                        text : 'Business Checking'
                    });
                    if (!o_customerData.isperson){
                        fld_bankType.defaultValue = 'businessChecking';
                    }
                    context.form.getField({id: 'custrecord_an_token_bank_accounttype'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    var fld_achType = context.form.addField({id:'custpage_achtype', type:ui.FieldType.SELECT, label : context.form.getField({id:'custrecord_an_token_bank_echecktype'}).label})
                    fld_achType.addSelectOption({
                        value : '',
                        text : ''
                    });
                    fld_achType.addSelectOption({
                        value : 'PPD',
                        text : 'PPD'
                    });
                    fld_achType.addSelectOption({
                        value : 'CCD',
                        text : 'CCD'
                    });
                    if (!o_customerData.isperson){
                        fld_achType.defaultValue = 'CCD';
                    }
                    context.form.getField({id: 'custrecord_an_token_bank_echecktype'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                }
                else if (context.type === 'edit'){
                    if (iseCheck){
                        setACHDisplay(context)
                    }
                    else
                    {
                        setCCDisplay(context);
                    }
                }
                else if (context.type === 'view'){
                    if (iseCheck){
                        setACHDisplay(context)
                    }
                    else
                    {
                        setCCDisplay(context)
                    }
                }
            }
        }
        function beforeSubmit(context) {
            //get the config for this token - incase we need it
            var o_config = authNet.getConfigFromCache(+context.newRecord.getValue({fieldId: 'custrecord_an_token_gateway'}));
            //when context.type === create, hash things and add to the transaction so it matches
            //if the runtime is not suitelet - throw an exception
            if (!_.includes(['delete', 'create'], context.type)){
                if (authNet.mkpblkchain(context.newRecord, context.newRecord.id) !== context.oldRecord.getValue({fieldId: 'custrecord_an_token_pblkchn'})) {
                    context.newRecord.setValue({fieldId : 'custrecord_an_token_pblkchn_tampered', value : true });
                    context.newRecord.setValue({fieldId : 'isinactive', value : true });
                }
                else if (+context.newRecord.getValue({fieldId: 'custrecord_an_token_paymenttype'}) === 0)
                {
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_paymenttype', value : 1});
                }
            }
            else if (context.type === 'create' && runtime.executionContext === runtime.ContextType.USER_INTERFACE )
            {
                context.newRecord.setValue({fieldId: 'custrecord_an_token_uuid', value :authNet.buildUUID()});
                //clean the heck out of the user entered fields
                context.newRecord.setValue({fieldId: 'custrecord_an_token_bank_bankname', value : _.trim(context.newRecord.getValue({fieldId: 'custrecord_an_token_bank_bankname'}))});
                context.newRecord.setValue({fieldId: 'custrecord_an_token_bank_accountnumber', value :_.trim(context.newRecord.getValue({fieldId: 'custrecord_an_token_bank_accountnumber'}))});
                context.newRecord.setValue({fieldId: 'custrecord_an_token_bank_nameonaccount', value :_.trim(context.newRecord.getValue({fieldId: 'custrecord_an_token_bank_nameonaccount'}))});
                context.newRecord.setValue({fieldId: 'custrecord_an_token_bank_routingnumber', value :_.trim(context.newRecord.getValue({fieldId: 'custrecord_an_token_bank_routingnumber'}))});

                var o_newProfile = authNet.createNewProfile(context.newRecord, o_config);
                //log.debug('o_newProfile', o_newProfile)
                //this is a new in in the UI entry - so we need to generate the profile!
                if (!o_newProfile.success){
                    //build link to the history record for reference
                    var historyURL = url.resolveRecord({
                        recordType: 'customrecord_authnet_history',
                        recordId: o_newProfile.histId,
                        isEditMode: false
                    });
                    var s_error = 'Unable to validate payment method - error received:<br>'+
                        'CODE : '+ o_newProfile.code + '<br>' +
                        'MESSAGE : ' +o_newProfile.message + '<br>' + 'Click <a href="'+historyURL+'" target="_blank">here</a> to view the Authorize.Net Response if you need additinal inforamtion.'
                    throw s_error;
                }
                //flags this haveing used liveMode upon creation - meaning it's a "better" token
                context.newRecord.setValue({fieldId: 'custrecord_an_token_usedlivemode', value :o_config.custrecord_an_cim_live_mode.val});

                if (+context.newRecord.getValue({fieldId: 'custrecord_an_token_paymenttype'}) === 2){
                    //get the 2 custom fields and set into the real fields
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_bank_accounttype', value : context.newRecord.getValue({fieldId: 'custpage_banktype'})});
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_bank_echecktype', value : context.newRecord.getValue({fieldId: 'custpage_achtype'})});
                    log.debug('ACH in UE - o_newProfile', o_newProfile);
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_customerid', value : o_newProfile.customerProfileId});
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_token', value : o_newProfile.customerPaymentProfileIdList[0]});
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_type', value : o_newProfile.bankAccount.accountType});
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_last4', value : o_newProfile.bankAccount.accountNum});
                    context.newRecord.setValue({fieldId: 'name', value : o_newProfile.bankAccount.accountType + ' ('+o_newProfile.bankAccount.accountNum+')'});
                }
                else
                {
                    //build the name {Card Type} (XXXX{last 4})
                    log.debug('CC in UE - o_newProfile', o_newProfile);
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_customerid', value : o_newProfile.customerProfileId});
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_token', value : o_newProfile.customerPaymentProfileIdList[0]});
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_type', value : o_newProfile.creditCard.cardnum});
                    context.newRecord.setValue({fieldId: 'custrecord_an_token_last4', value : o_newProfile.creditCard.cardtype});
                    context.newRecord.setValue({fieldId: 'name', value : o_newProfile.creditCard.cardtype + ' ('+o_newProfile.creditCard.cardnum+')'});
                }
            }
            if(context.type === 'create'|| context.type === 'edit')
            {
                if (context.newRecord.getValue({fieldId: 'custrecord_an_token_default'})){
                    //find all other default cards for this customer and uncheck this box
                    try {
                        search.create({
                            type: 'customrecord_authnet_tokens',
                            filters: [
                                ['custrecord_an_token_entity', 'anyof', context.newRecord.getValue({fieldId: 'custrecord_an_token_entity'})],
                                "AND",
                                ['custrecord_an_token_default', 'is', 'T']
                            ],
                            columns: []
                        }).run().each(function (result) {
                            //log.debug('logError.result', result);
                            record.submitFields({
                                type: 'customrecord_authnet_tokens',
                                id: result.id,
                                values: {
                                    custrecord_an_token_default: ''
                                },
                                options: {
                                    enableSourcing: false,
                                    ignoreMandatoryFields: true
                                }
                            });
                            return true;
                        });
                    }
                    catch (ex)
                    {
                        log.error('Unable to change default token for this customer internalid >>', context.newRecord.getValue({fieldId: 'custrecord_an_token_entity'}))
                    }
                }
            }
        }
        function afterSubmit(context) {
            if (context.type === 'create') {
                //added support for importing existing profile's into NetSuite for use after pulling all the profile information from the API
                if (runtime.executionContext === runtime.ContextType.CSV_IMPORT){
                    //get the profile off the profile import and then hash the record
                    //https://developer.authorize.net/api/reference/index.html#customer-profiles-get-customer-profile
                    var importedProfile = authNet.importCIMToken(context.newRecord.toJSON());
                    //log.debug('importedProfile', importedProfile);
                    if (importedProfile.profile.paymentProfiles.length > 0)
                    {
                        var idx = 0;
                        _.forEach(importedProfile.profile.paymentProfiles, function(profile){
                           if (idx === 0)
                           {
                               //update the imported record with the first profile
                               var rec_cimProfile = record.load({type: 'customrecord_authnet_tokens', id: context.newRecord.id, isDynamic: true});
                               rec_cimProfile.setValue({fieldId: 'custrecord_an_token_token', value: profile.customerPaymentProfileId});
                               if (!_.isUndefined(profile.payment.creditCard)){
                                   rec_cimProfile.setValue({fieldId: 'custrecord_an_token_paymenttype', value : 1});
                                   rec_cimProfile.setValue({fieldId: 'custrecord_an_token_type', value : profile.payment.creditCard.cardType});
                                   rec_cimProfile.setValue({fieldId: 'custrecord_an_token_last4', value : profile.payment.creditCard.cardNumber});
                                   rec_cimProfile.setValue({fieldId: 'custrecord_an_token_expdate', value : profile.payment.creditCard.expirationDate});
                                   rec_cimProfile.setValue({fieldId: 'name', value :profile.payment.creditCard.cardType +' ('+profile.payment.creditCard.cardNumber+')'});
                               } else {
                                   rec_cimProfile.setValue({fieldId: 'name', value :importedProfile.profile.description});
                               }
                               rec_cimProfile.setValue({fieldId: 'custrecord_an_token_pblkchn', value: authNet.mkpblkchain(rec_cimProfile, rec_cimProfile.id)});
                               rec_cimProfile.save();
                           }
                           else
                           {
                               //make a new record from the ground up for every otehr profile that's imported
                               var rec_cimProfileNew = record.create({type: 'customrecord_authnet_tokens', isDynamic: true});
                               rec_cimProfileNew.setValue({fieldId: 'custrecord_an_token_token', value: profile.customerPaymentProfileId});
                               if (!_.isUndefined(profile.payment.creditCard)){
                                   rec_cimProfileNew.setValue({fieldId: 'custrecord_an_token_paymenttype', value : 1});
                                   rec_cimProfileNew.setValue({fieldId: 'custrecord_an_token_type', value : profile.payment.creditCard.cardType});
                                   rec_cimProfileNew.setValue({fieldId: 'custrecord_an_token_last4', value : profile.payment.creditCard.cardNumber});
                                   rec_cimProfileNew.setValue({fieldId: 'custrecord_an_token_expdate', value : profile.payment.creditCard.expirationDate});
                                   rec_cimProfileNew.setValue({fieldId: 'name', value :profile.payment.creditCard.cardType +' ('+profile.payment.creditCard.cardNumber+')'});
                               } else {
                                   rec_cimProfileNew.setValue({fieldId: 'name', value :importedProfile.profile.description});
                               }
                               rec_cimProfileNew.setValue({fieldId: 'custrecord_an_token_pblkchn', value: authNet.mkpblkchain(rec_cimProfileNew, rec_cimProfileNew.id)});
                               rec_cimProfileNew.save();
                           }
                           //increment the counter to start building more profiles
                           idx++;
                        });
                    }
                    else
                    {
                        record.delete({type: 'customrecord_authnet_tokens', id: context.newRecord.id});
                        //nice error for the CSV import error column
                        throw error.create({
                            name : 'CIM Customer ID has No Valid Payment Profiles',
                            message : 'This customer has no active / valid payment profiles and none were imported'
                        });
                    }
                }
                else
                {
                    record.submitFields({
                        type: context.newRecord.type,
                        id: context.newRecord.id,
                        values: {
                            custrecord_an_token_pblkchn: authNet.mkpblkchain(context.newRecord, context.newRecord.id)
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                }
            }
        }
        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });