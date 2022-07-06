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


define(['N/record', 'N/url', 'N/runtime', 'N/redirect', 'N/ui/serverWidget', 'N/ui/message', 'N/cache', 'N/task', 'lodash', 'moment', './AuthNet_lib'],
    function (record, url, runtime, redirect, ui, message, cache, task, _, moment, authNet) {

        function beforeLoad(context) {
            //log.debug('parameters', _.keys(context))
            //log.debug('context.requet', _.keys(context.request))

            if (runtime.getCurrentUser().role === 3) {
                context.form.addFieldGroup({
                    id: 'custpage_admin',
                    label: 'Visible in Administrator Role Only'
                });
                var fld_configLink = context.form.addField({
                    id: 'custpage_configlink',
                    type: ui.FieldType.INLINEHTML,
                    label: 'Tool Configuration Information',
                    container: 'custpage_admin'
                });
                fld_configLink.defaultValue = '<a target="_blank" href="' + url.resolveScript({
                    scriptId: 'customscript_c9_authnet_screen_svc',
                    deploymentId: 'customdeploy_c9_authnet_screen_svc',
                    params: {debugger : 'totallytrue'}
                }) + '">Debug & Testing Tool</a> (Use at your own peril!)';
            } else if (_.includes(['view', 'edit', 'create'], context.type)){
                //hide the URL fields
                context.form.getField({id: 'custrecord_an_url'}).updateDisplayType({
                    displayType: ui.FieldDisplayType.HIDDEN
                });
                context.form.getField({id: 'custrecord_an_url_sb'}).updateDisplayType({
                    displayType: ui.FieldDisplayType.HIDDEN
                });
            }

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
                    //log.debug('PROD o_testResult', o_testResult)
                    context.form.addPageInitMessage({
                        type: o_testResult.level,
                        title: o_testResult.title,
                        message: o_testResult.message,
                        //duration : _.isUndefined(o_testResult.duration) ? '' : o_testResult.duration
                    });

                    if (!o_testResult.isValid
                    &&
                        context.newRecord.setValue({fieldId: 'custrecord_an_islive'}) === 'T'
                    ){
                        log.audit('Disabling the Production Credentials', 'They failed to authenticate!');
                        record.submitFields({
                            type: context.newRecord.type,
                            id : context.newRecord.id,
                            values : {
                                'custrecord_an_islive' : false,
                                'custrecord_an_skip_on_save':true
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
                    //log.debug('SB o_testResult', o_testResult)
                    context.form.addPageInitMessage({
                        type: o_testResult.level,
                        title: o_testResult.title,
                        message: o_testResult.message,
                        //duration : _.isUndefined(o_testResult.duration) ? '' : o_testResult.duration
                    });
                }
            }
            if (context.newRecord.getValue({fieldId :'custrecord_an_version'}) !== authNet.VERSION
            &&
                !_.includes(['xedit', 'delete'], context.type)
            )
            {
                if (!context.newRecord.getValue({fieldId: 'custrecord_an_skip_on_save'})) {
                    try {
                        context.form.addPageInitMessage({
                            type: message.Type.INFORMATION,
                            title: 'SYSTEM IS UPDATING CONFIGURATION',
                            message: 'Your configuration is updating, please refresh this page until this message is gone before making any changes.',
                        });
                        var scriptTask = task.create({
                            taskType: task.TaskType.SCHEDULED_SCRIPT,
                            scriptId: 'customscript_sac_ss2_update_cfg',
                            deploymentId: 'customdeploy_sac_ss2_update_cfg_o'
                        });
                        var scriptTaskId = scriptTask.submit();
                        //log.debug('scriptTaskId', scriptTaskId)
                        log.audit('Process for intial setup is running ', task.checkStatus(scriptTaskId));
                    } catch (ex) {
                        log.emergency(ex.name, ex.message);
                    }
                }
                else
                {
                    log.audit('Updated by upgrade script this one time!', 'Not tryint to re-upgrade!');
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
            log.debug('aftersubmit', context.type)
            if (_.includes(['create', 'edit', 'xedit'], context.type)
            &&
                !context.newRecord.getValue({fieldId: 'custrecord_an_skip_on_save'})
            )
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
            //beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });