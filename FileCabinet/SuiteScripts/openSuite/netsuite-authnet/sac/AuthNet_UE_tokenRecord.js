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


define(['N/record', 'N/encode', 'N/runtime', 'N/crypto', 'N/error', 'lodash'],
    function (record, encode, runtime, crypto, error, _) {

        function buildHash(context){
            var s_rawData =
                context.newRecord.id +
                context.newRecord.getValue({fieldId : 'custrecord_an_token_entity'})+
                context.newRecord.getValue({fieldId : 'custrecord_an_token_customerid'})+
                context.newRecord.getValue({fieldId : 'custrecord_an_token_token'})+
                context.newRecord.getValue({fieldId : 'custrecord_an_token_type'})+
                context.newRecord.getValue({fieldId : 'custrecord_an_token_last4'})+
                context.newRecord.getValue({fieldId : 'custrecord_an_token_expdate'})+
                context.newRecord.getValue({fieldId : 'custrecord_an_token_gateway'})+
                JSON.stringify(context.newRecord.getValue({fieldId : 'custrecord_tt_linked'}));
            s_rawData = s_rawData.replace(/\s/g, "");
            //log.debug('s_rawData', s_rawData)

            var hashObj = crypto.createHash({
                algorithm: crypto.HashAlg.SHA512
            });
            hashObj.update({
                input: s_rawData
            });
            var s_hash = hashObj.digest({
                outputEncoding: encode.Encoding.HEX
            });
            //log.debug('pblockchain', s_hash);
            return s_hash;
        }

        function beforeLoad(context) {
            //when loading validate the hash and throw an alert if it's invalid
            if (context.type !== 'create'){
                if (context.newRecord.getValue({fieldId : 'custrecord_an_token_pblkchn_tampered'}) || (buildHash(context) !== context.newRecord.getValue({fieldId : 'custrecord_an_token_pblkchn'}))){
                    log.error('hash mismatch!', context.newRecord.getValue({fieldId : 'custrecord_an_token_pblkchn'}))
                    //todo - show the error on the tombstone in the UI
                }
            }

        }
        function beforeSubmit(context) {
            //when context.type === create, hash things and add to the transaction so it matches
            //if the runtime is not suitelet - throw an exception
            if (!_.includes(['delete', 'create'], context.type)){
                if (buildHash(context) !== context.oldRecord.getValue({fieldId: 'custrecord_an_token_pblkchn'})) {
                    context.newRecord.setValue({fieldId : 'custrecord_an_token_pblkchn_tampered', value : true });
                }
            }

        }
        function afterSubmit(context) {
            if (context.type === 'create') { //&& runtime
                record.submitFields({
                    type: context.newRecord.type,
                    id: context.newRecord.id,
                    values: {
                        custrecord_an_token_pblkchn: buildHash(context)
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            }
        }
        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });