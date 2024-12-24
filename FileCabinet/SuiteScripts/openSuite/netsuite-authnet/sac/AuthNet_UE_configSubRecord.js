/**
 * Module Description...
 *
 * @exports XXX
 *
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
 * IN NO EVENT SHALL CLOUD 1001, LLC BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF CLOUD 1001, LLC HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * CLOUD 1001, LLC SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE AND ACCOMPANYING DOCUMENTATION, IF ANY, PROVIDED HEREUNDER IS PROVIDED "AS IS". CLOUD 1001, LLC HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
 *
 * @author Cloud 1001, LLC <suiteauthconnect@gocloud1001.com>
 *
 * @NApiVersion 2.0
 * @NModuleScope Public
 * @NScriptType UserEventScript
 *
 * @NAmdConfig ../config.json
 */


define(['N/record', 'N/url', 'N/https', 'N/runtime', 'N/redirect', 'N/ui/serverWidget', 'N/ui/message', 'N/cache', 'N/task', 'N/search', 'lodash', 'moment', './AuthNet_lib'],
    function (record, url, https, runtime, redirect, ui, message, cache, task, search, _, moment, authNet) {

        function beforeLoad(context) {

            var o_masterConfig = search.lookupFields({
                type : 'customrecord_authnet_config',
                id : context.newRecord.getValue({fieldId: 'custrecord_ancs_parent_config'}),
                columns : ['custrecord_an_url', 'custrecord_an_url_sb', 'custrecord_an_all_sub']
            });
            if (context.type === 'create')
            {
                //hard check to prevent these from being used if the master config is not set up for them
                if (o_masterConfig.custrecord_an_all_sub)
                {
                    throw 'You can not create an Authorize.Net Configuration Subsidiary record while the configuration has "<b>USE FOR ALL SUBSIDIARIES</b>" checked.<br/>Go back to the configuration and uncheck that box and carefully consider the instructions given.'
                }
            }
            if (runtime.executionContext === runtime.ContextType.USER_INTERFACE)
            {
                if (runtime.isFeatureInEffect({feature: 'multisubsidiarycustomer'}))
                {
                    if (context.type === 'edit')
                    {
                        context.form.getField({id: 'custrecord_ancs_card_prefix'}).isMandatory = true;
                    }
                }
                else
                {
                    //if this is not a multi sub enebaled account, this field isn't needed
                    context.form.getField({id: 'custrecord_ancs_card_prefix'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                }

                if (context.type === 'view' || context.type === 'edit') {
                    //make sure if the Subsidiary feature is enabled - that there is at least 1 record and that it is fully configured

                    if (context.newRecord.getValue({fieldId: 'custrecord_ancs_login'}) && context.newRecord.getValue({fieldId: 'custrecord_ancs_trankey'})) {
                        var o_testResult = authNet.doTest({
                            url: o_masterConfig.custrecord_an_url,
                            type: 'production',
                            auth: {
                                name: context.newRecord.getValue({fieldId: 'custrecord_ancs_login'}),
                                transactionKey: context.newRecord.getValue({fieldId: 'custrecord_ancs_trankey'})
                            }
                        });
                        //log.debug('PROD o_testResult', o_testResult)
                        context.form.addPageInitMessage({
                            type: o_testResult.level,
                            title: o_testResult.title,
                            message: o_testResult.message,
                            //duration : _.isUndefined(o_testResult.duration) ? '' : o_testResult.duration
                        });

                        if (!o_testResult.isValid
                            &&
                            context.newRecord.setValue({fieldId: 'custrecord_ancs_islive'}) === 'T'
                        ) {
                            log.audit('Disabling the Production Credentials', 'They failed to authenticate!');
                            record.submitFields({
                                type: context.newRecord.type,
                                id: context.newRecord.id,
                                values: {
                                    'custrecord_ancs_islive': false,
                                }
                            });
                        }
                    }

                    if (context.newRecord.getValue({fieldId: 'custrecord_ancs_login_sb'}) && context.newRecord.getValue({fieldId: 'custrecord_ancs_trankey_sb'})) {
                        var o_testResult = authNet.doTest({
                            url: o_masterConfig.custrecord_an_url_sb,
                            type: 'sandbox',
                            auth: {
                                name: context.newRecord.getValue({fieldId: 'custrecord_ancs_login_sb'}),
                                transactionKey: context.newRecord.getValue({fieldId: 'custrecord_ancs_trankey_sb'})
                            }
                        });
                        //log.debug('SB o_testResult', o_testResult)
                        context.form.addPageInitMessage({
                            type: o_testResult.level,
                            title: o_testResult.title,
                            message: o_testResult.message,
                            //duration : _.isUndefined(o_testResult.duration) ? '' : o_testResult.duration
                        });
                    }
                    if (_.includes(['view', 'edit', 'create'], context.type) && runtime.getCurrentUser().role !== 3) {
                        //hide the API key fields
                        context.form.getField({id: 'custrecord_ancs_login_sb'}).updateDisplayType({
                            displayType: ui.FieldDisplayType.HIDDEN
                        });
                        context.form.getField({id: 'custrecord_ancs_trankey_sb'}).updateDisplayType({
                            displayType: ui.FieldDisplayType.HIDDEN
                        });
                        context.form.getField({id: 'custrecord_ancs_login'}).updateDisplayType({
                            displayType: ui.FieldDisplayType.HIDDEN
                        });
                        context.form.getField({id: 'custrecord_ancs_trankey'}).updateDisplayType({
                            displayType: ui.FieldDisplayType.HIDDEN
                        });
                        log.audit('All Credential Fields were hidden', 'Only Administrator Role can see and edit theses fields');
                    }
                }
            }
        }
        function beforeSubmit(context) {

            if (_.includes(['create', 'copy'], context.type)){
                //look for the SAME sub already in play - inactivate them!
                search.create({
                    type: 'customrecord_authnet_config_subsidiary',
                    filters: [
                        ['custrecord_ancs_subsidiary', 'anyof', [context.newRecord.getValue({fieldId: 'custrecord_ancs_subsidiary'})]]
                    ],
                    columns: [
                        {name: 'name'},
                        {name: 'custrecord_ancs_subsidiary'}
                    ]
                }).run().each(function (result) {
                    var _recordlink = url.resolveRecord({
                        recordType: 'customrecord_authnet_config_subsidiary',
                        recordId: result.id
                    });
                    throw 'You can not create more than 1 Authorize.Net Subsidiary configuration witin your account for the same subsidiary.<br /><br />   The configuration <i><a href="'+_recordlink+'">' + result.getValue('name') + '</a></i> already exists - for the subsidiary <i>'+result.getText('custrecord_ancs_subsidiary')+'</i> click the link to review that configuration and/or update it.';
                });
            }

        }
        function afterSubmit(context) {
            log.debug('aftersubmit', context.type)

            if (_.includes(['create', 'edit', 'xedit', 'delete'], context.type))
            {
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