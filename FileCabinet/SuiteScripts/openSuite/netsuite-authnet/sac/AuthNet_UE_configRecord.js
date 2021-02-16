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


define(['N/record', 'N/runtime', 'N/redirect', 'N/ui/serverWidget', 'N/cache', 'lodash', 'moment', './AuthNet_lib'],
    function (record, runtime, redirect, ui, cache, _, moment, authNet) {

        function beforeLoad(context) {
            //log.debug('parameters', _.keys(context))
            //log.debug('context.requet', _.keys(context.request))

            function makeAlertField(context, o_builderObject){
                var test_fld = context.form.addField({
                    id: 'custpage_c9_'+o_builderObject.type,
                    type: ui.FieldType.INLINEHTML,
                    label: 'WARNING'
                });

                if (o_builderObject.isValid){
                    o_builderObject.duration = 5000;
                }
                var html = '<script>';
                html += 'require([\'N/ui/message\'], function (message){'; // Loads the N/ui/message module
                html += 'var onViewMessage = message.create({'; // Creates a message
                html += 'title: "%%TITLE%%", '; // Sets message title
                html += 'message: "%%MESSAGE%%", '; // Sets the message content
                html += 'type: message.Type.%%LEVEL%%'; // Sets the type of the message using enum
                html += '}); ';
                html += 'onViewMessage.show(%%DURATION%%);'; // Sets the amount of time (in ms) to show the message
                html += '})';
                html += '</script>';

                html = html.replace(/%%LEVEL%%/g, o_builderObject.level);
                html = html.replace('%%TITLE%%', o_builderObject.title);
                html = html.replace('%%MESSAGE%%', o_builderObject.message);
                html = html.replace('%%DURATION%%', _.isUndefined(o_builderObject.duration) ? '' : o_builderObject.duration);
                test_fld.defaultValue = html;
            }
            
            //when loading validate the hash and throw an alert if it's invalid
            if (_.includes(['view', 'edit', 'create'], context.type)){
                //check for license and display notice at top of page...

                //hide the URL fields
                context.form.getField({id: 'custrecord_an_url'}).updateDisplayType({
                    displayType: ui.FieldDisplayType.HIDDEN
                });
                context.form.getField({id: 'custrecord_an_url_sb'}).updateDisplayType({
                    displayType: ui.FieldDisplayType.HIDDEN
                });
            }

            //log.debug('.validateLicence2', authNet.validateLicence2())


            if (context.type === 'view'){

                if (context.newRecord.getValue({fieldId : 'custrecord_an_login'}) && context.newRecord.getValue({fieldId : 'custrecord_an_trankey'})){
                    var o_testResult = authNet.doTest({
                        url: context.newRecord.getValue({fieldId :'custrecord_an_url'}),
                        type : 'production',
                        auth : {
                            name : context.newRecord.getValue({fieldId : 'custrecord_an_login'}),
                            transactionKey : context.newRecord.getValue({fieldId : 'custrecord_an_trankey'})
                        }
                    });
                    makeAlertField(context, o_testResult);
                    if (!o_testResult.isValid){
                        record.submitFields({
                            type: context.newRecord.type,
                            id : context.newRecord.id,
                            values : {
                                'custrecord_an_islive' : false
                            }
                        });
                    }
                }

                if (context.newRecord.getValue({fieldId : 'custrecord_an_login_sb'}) && context.newRecord.getValue({fieldId : 'custrecord_an_trankey_sb'})){
                    var o_testResult = authNet.doTest({
                        url: context.newRecord.getValue({fieldId :'custrecord_an_url_sb'}),
                        type : 'sandbox',
                        auth : {
                            name : context.newRecord.getValue({fieldId : 'custrecord_an_login_sb'}),
                            transactionKey : context.newRecord.getValue({fieldId : 'custrecord_an_trankey_sb'})
                        }
                    });
                    makeAlertField(context, o_testResult);
                }
            }


        }
        function beforeSubmit(context) {
            //when context.type === create, hash things and add to the transaction so it matches
            //if the runtime is not suitelet - throw an exception
            if (context.type !== 'delete'){

            }

        }
        function afterSubmit(context) {
            //log.debug('aftersubmit', context.type)
            if (_.includes(['create', 'edit', 'xedit'], context.type)) {
                var daCache = cache.getCache(
                    {
                        name: 'config',
                        scope: cache.Scope.PROTECTED
                    }
                );
                daCache.remove({
                    key: 'config'
                });
                daCache.put({
                    key: 'config',
                    value: authNet.cacheActiveConfig(),
                    ttl: 3600
                });
                log.audit('The config cache was just updated!', 'Speed is important to us! (for the next 60 minutes at least!)')
            }
        }



        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });