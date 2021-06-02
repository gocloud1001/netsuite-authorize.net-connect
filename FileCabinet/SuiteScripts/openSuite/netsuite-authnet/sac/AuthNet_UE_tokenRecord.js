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


define(['N/record', 'N/encode', 'N/runtime', 'N/crypto', 'N/error', 'N/ui/message', 'lodash', './AuthNet_lib'],
    function (record, encode, runtime, crypto, error, message, _, authNet) {

        function beforeLoad(context) {
            //when loading validate the hash and throw an alert if it's invalid

            if (!_.includes(['delete', 'create'], context.type)){
                if (context.newRecord.getValue({fieldId : 'custrecord_an_token_pblkchn_tampered'}) || (authNet.mkpblkchain(context.newRecord, context.newRecord.id) !== context.newRecord.getValue({fieldId : 'custrecord_an_token_pblkchn'}))){
                    log.error('hash mismatch!', context.newRecord.getValue({fieldId : 'custrecord_an_token_pblkchn'}))
                    context.form.addPageInitMessage({
                        type: message.Type.ERROR,
                        title: 'This Payment Profile has been tampered with',
                        message: 'It will no longer function in NetSuite until a new transaction has used the card data again and the profile is validated as good off actual card data.<br />To see who may have tampered with this record view the System Notes below.',
                        //duration: 5000
                    });
                }
            }

        }
        function beforeSubmit(context) {
            //when context.type === create, hash things and add to the transaction so it matches
            //if the runtime is not suitelet - throw an exception
            if (!_.includes(['delete', 'create'], context.type)){
                if (authNet.mkpblkchain(context.newRecord, context.newRecord.id) !== context.oldRecord.getValue({fieldId: 'custrecord_an_token_pblkchn'})) {
                    context.newRecord.setValue({fieldId : 'custrecord_an_token_pblkchn_tampered', value : true });
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