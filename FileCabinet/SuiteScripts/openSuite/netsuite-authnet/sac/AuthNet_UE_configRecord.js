/**
 * Module Description...
 *
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
 * @NScriptType UserEventScript
 *
 * @NAmdConfig ../config.json
 */


define(['N/record', 'N/url', 'N/https', 'N/runtime', 'N/redirect', 'N/ui/serverWidget', 'N/ui/message', 'N/cache', 'N/task', 'N/search', 'lodash', 'moment', './AuthNet_lib'],
    function (record, url, https, runtime, redirect, ui, message, cache, task, search, _, moment, authNet) {

        function beforeLoad(context) {
            //make all this UI only
            if (runtime.executionContext === 'USERINTERFACE' ) {
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
                        deploymentId: 'customdeploy_sac_authnet_screen_svc',
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
                    //hide the API key fields
                    context.form.getField({id: 'custrecord_an_login_sb'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    context.form.getField({id: 'custrecord_an_trankey_sb'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    context.form.getField({id: 'custrecord_an_login'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    context.form.getField({id: 'custrecord_an_trankey'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    //nothing good can come of these buttons
                    context.form.removeButton({id:'new'});
                    context.form.removeButton({id:'makecopy'});
                    context.form.removeButton({id:'print'});
                    log.audit('All Credential Fields were hidden', 'Only Administrator Role can see and edit theses fields');
                }

                var fld_subconfig = context.form.addField({
                    id: 'custpage_change_sub',
                    label: 'Initial Subsidiary Setup',
                    type: ui.FieldType.SELECT,
                    source: 'subsidiary'
                });
                context.form.insertField({
                    field: fld_subconfig,
                    nextfield: 'custrecord_an_all_sub'
                });
                if (!context.newRecord.getValue({fieldId: 'custrecord_an_all_sub'}) || context.type === 'view') {
                    fld_subconfig.updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                }


                if (context.type === 'edit' || context.type === 'view') {
                    if (!context.newRecord.getValue({fieldId: 'custrecord_an_all_sub'}))
                    {
                        var b_noConfig = true;
                        search.create({
                            type: 'customrecord_authnet_config_subsidiary',
                            filters: [
                                ['custrecord_ancs_parent_config', 'anyof', context.newRecord.id],
                            ],
                            columns: []
                        }).run().each(function (result) {
                            b_noConfig = false;
                        });
                        if (b_noConfig) {
                            context.form.addPageInitMessage({
                                type: message.Type.ERROR,
                                title: 'No Subsidiaries Configured',
                                message: 'You enabled subsidiary configuration - but have no subsidiaries configured with valid credentials.<br/>' +
                                    'Scroll to the bottom of this page and add at least one subsidiary with appropriate Authorize.Net credentials.'
                            });
                            if (context.newRecord.getValue({fieldId: 'custrecord_an_enable'})) {
                                log.audit('Disable the configuration', 'No subs are configured so that was weird!');
                                record.submitFields({
                                    type: context.newRecord.type,
                                    id: context.newRecord.id,
                                    values: {
                                        'custrecord_an_enable': false,
                                    }
                                });
                            }
                        }
                        //added to block reverting to a non-sub config and causing issues
                        _.forEach([
                            'custrecord_an_islive',
                            'custrecord_an_login',
                            'custrecord_an_trankey',
                            'custrecord_an_login_sb',
                            'custrecord_an_trankey_sb',
                            'custrecord_an_all_sub',
                            'custrecord_an_url',
                            'custrecord_an_url_sb',
                            'custrecord_an_txn_companyname',
                            'custrecord_an_devicetype',
                            'custrecord_an_marketype',
                        ], function (fld) {
                            context.form.getField({id: fld}).updateDisplayType({
                                displayType: ui.FieldDisplayType.HIDDEN
                            });
                        });
                        //now add a field indicating that subsidiary mode is active
                        var fld_guidance = context.form.addField({
                            id: 'custpage_insub_mode',
                            label: 'To manage the gateway configuration, credentials and ' +
                                'live status - use the sublist at the bottom of the screen.  Only subsidiaries configured will process via Authorize.net.  ' +
                                'You can use the same gateway credentials across multiple subsidiaries if you wish.',
                            type: ui.FieldType.HELP
                        });
                        context.form.insertField({
                            field: fld_guidance,
                            nextfield: 'lastmodified'
                        });
                    }
                    else
                    {
                        //when checked - hide the whole subtab from view to make life simpler for everyone!
                        var sublist = context.form.getSublist({
                            id : 'recmachcustrecord_ancs_parent_config',
                        });
                        sublist.displayType = ui.SublistDisplayType.HIDDEN;
                    }
                    if (!context.newRecord.getValue({fieldId: 'custrecord_an_enable'})) {
                        context.form.addPageInitMessage({
                            type: message.Type.INFORMATION,
                            title: 'ENABLE CONFIGURATION is NOT Checked',
                            message: 'This means no transaction (either using production OR sandbox credentials) will process in your NetSuite account.<br/>' +
                                'This is fine if you are not yet ready to enable the configuration throughout NetSuite.'
                        });
                    }

                }

                if (context.type === 'view') {
                    //make sure if the Subsidiary feature is enabled - that there is at least 1 record and that it is fully configured
                    if (!context.newRecord.getValue({fieldId: 'custrecord_an_all_sub'})) {
                        var b_majorIssue = false;
                        search.create({
                            type: 'customrecord_authnet_config_subsidiary',
                            filters: [
                                ['custrecord_ancs_subsidiary', 'anyof', '@NONE@'],
                                "OR",
                                ['custrecord_ancs_parent_config', 'anyof', '@NONE@']
                            ],
                            columns: [
                                {name: 'name', sort: search.Sort.DESC}
                            ]
                        }).run().each(function (result) {
                            var _recordlink = url.resolveRecord({
                                recordType: 'customrecord_authnet_config_subsidiary',
                                recordId: result.id,
                                isEditMode: true
                            });
                            context.form.addPageInitMessage({
                                type: message.Type.ERROR,
                                title: 'A Subsidiary Record is Misconfigured',
                                message: 'Immediately review and fix the subsidiary configuration <a target="_blank" href="' + _recordlink + '">' + result.getValue('name') + '</a>  failure to resolve this will result in transaction proeccing errors!',
                                duration: 60000
                            });
                            b_majorIssue = true;
                        });

                        //now show the test message for each of the sub records
                        if (!b_majorIssue) {
                            var b_allGood = true, b_anyResults = false, s_issue = '<ul>';
                            search.create({
                                type: 'customrecord_authnet_config_subsidiary',
                                filters: [
                                    ['custrecord_ancs_active', 'is', 'T'],
                                ],
                                columns: [
                                    {name: 'name', sort: search.Sort.DESC},
                                    {name: 'custrecord_ancs_login'},
                                    {name: 'custrecord_ancs_trankey'},
                                    {name: 'custrecord_ancs_login_sb'},
                                    {name: 'custrecord_ancs_trankey_sb'},
                                    {name: 'custrecord_ancs_islive'},
                                ]
                            }).run().each(function (result) {
                                b_anyResults = true;
                                //TEst SB Creds
                                if (result.getValue('custrecord_ancs_login_sb')) {
                                    var o_testResultSB = authNet.doTest({
                                        url: context.newRecord.getValue({fieldId: 'custrecord_an_url_sb'}),
                                        type: 'sandbox',
                                        auth: {
                                            name: result.getValue('custrecord_ancs_login_sb'),
                                            transactionKey: result.getValue('custrecord_ancs_trankey_sb')
                                        }
                                    });
                                    log.debug('SB o_testResult', o_testResultSB)
                                    if (!o_testResultSB.isValid) {
                                        var _recordlink = url.resolveRecord({
                                            recordType: 'customrecord_authnet_config_subsidiary',
                                            recordId: result.id,
                                            isEditMode: true
                                        });
                                        s_issue += '<li>The subsidiary configuration <a target="_blank" href="' + _recordlink + '">' + result.getValue('name') + '</a>  failed to validate it\'s SANDBOX credentials!</li>'
                                        b_allGood = false;
                                    }
                                }
                                if (result.getValue('custrecord_ancs_login')) {
                                    var o_testResult = authNet.doTest({
                                        url: context.newRecord.getValue({fieldId: 'custrecord_an_url'}),
                                        type: 'production',
                                        auth: {
                                            name: result.getValue('custrecord_ancs_login'),
                                            transactionKey: result.getValue('custrecord_ancs_trankey')
                                        }
                                    });
                                    log.debug('production o_testResult', o_testResult)
                                    if (!o_testResult.isValid) {
                                        var _recordlink = url.resolveRecord({
                                            recordType: 'customrecord_authnet_config_subsidiary',
                                            recordId: result.id,
                                            isEditMode: true
                                        });
                                        s_issue += '<li>The subsidiary configuration <a target="_blank" href="' + _recordlink + '">' + result.getValue('name') + '</a>  failed to validate it\'s PRODUCTION credentials!</li>'
                                        b_allGood = false;
                                        record.submitFields({
                                            type: 'customrecord_authnet_config_subsidiary',
                                            id: result.id,
                                            values: {
                                                'custrecord_ancs_islive': false,
                                            }
                                        });
                                    }
                                }
                                return true;
                            });
                            s_issue += '</ul>'
                            if (b_anyResults) {
                                if (b_allGood) {
                                    context.form.addPageInitMessage({
                                        type: message.Type.CONFIRMATION,
                                        title: 'All <i>activated</i> subsidiary Authorize.Net credentials are valid',
                                        message: 'Authorize.Net is successfully connected for the tested credentials.',
                                        duration: 10000
                                    });
                                } else {
                                    context.form.addPageInitMessage({
                                        type: message.Type.ERROR,
                                        title: 'A Subsidiary failed credential validation',
                                        message: s_issue,
                                        duration: 60000
                                    });
                                }
                            }
                        }

                    } else {

                        if (context.newRecord.getValue({fieldId: 'custrecord_an_login_sb'}) && context.newRecord.getValue({fieldId: 'custrecord_an_trankey_sb'})) {
                            var o_testResult = authNet.doTest({
                                url: context.newRecord.getValue({fieldId: 'custrecord_an_url_sb'}),
                                type: 'sandbox',
                                auth: {
                                    name: context.newRecord.getValue({fieldId: 'custrecord_an_login_sb'}),
                                    transactionKey: context.newRecord.getValue({fieldId: 'custrecord_an_trankey_sb'})
                                }
                            });
                            //log.debug('SB o_testResult', o_testResult)
                            context.form.addPageInitMessage({
                                type: o_testResult.level,
                                title: o_testResult.title,
                                message: o_testResult.message,
                                duration: 6000
                                //duration : _.isUndefined(o_testResult.duration) ? '' : o_testResult.duration
                            });
                        }

                        if (context.newRecord.getValue({fieldId: 'custrecord_an_login'}) && context.newRecord.getValue({fieldId: 'custrecord_an_trankey'})) {
                            var o_testResult = authNet.doTest({
                                url: context.newRecord.getValue({fieldId: 'custrecord_an_url'}),
                                type: 'production',
                                auth: {
                                    name: context.newRecord.getValue({fieldId: 'custrecord_an_login'}),
                                    transactionKey: context.newRecord.getValue({fieldId: 'custrecord_an_trankey'})
                                }
                            });
                            //log.debug('PROD o_testResult', o_testResult)
                            context.form.addPageInitMessage({
                                type: o_testResult.level,
                                title: o_testResult.title,
                                message: o_testResult.message,
                                duration: 6000
                                //duration : _.isUndefined(o_testResult.duration) ? '' : o_testResult.duration
                            });

                            if (!o_testResult.isValid
                                &&
                                context.newRecord.setValue({fieldId: 'custrecord_an_islive'}) === 'T'
                            ) {
                                log.audit('Disabling the Production Credentials', 'They failed to authenticate!');
                                record.submitFields({
                                    type: context.newRecord.type,
                                    id: context.newRecord.id,
                                    values: {
                                        'custrecord_an_islive': false,
                                        'custrecord_an_skip_on_save': true
                                    }
                                });
                            }
                        }


                    }
                    //used to warn on upgrades of other needed processing


                    var a_activeDeployments = [];
                    var scriptdeploymentSearchObj = search.create({
                        type: "scheduledscriptinstance",
                        filters: [
                            ["script.scriptid","is",'customscript_sac_update_profiles'],
                            "AND",
                            ["status","anyof","PENDING","PROCESSING"]
                        ],
                        columns: [
                            search.createColumn({
                                name: "formulatext",
                                formula: "{scriptdeployment.scriptid}"
                            }),
                            "status"
                        ]
                    });
                    scriptdeploymentSearchObj.run().each(function(result){
                        a_activeDeployments.push(_.toUpper(result.getValue('formulatext')));
                        return true;
                    });

                    if (a_activeDeployments.length > 0)
                    {
                        var numberLeft = 0;
                        search.create({
                            type: 'customrecord_authnet_tokens',
                            filters : [
                                ['custrecord_an_token_paymenttype', 'anyof', '@NONE@'],
                                "AND",
                                ['isinactive', 'is', 'F'],
                                "AND",
                                ['custrecord_an_token_pblkchn_tampered', 'is', 'F']
                            ],
                            columns : [
                                {name:'internalid', summary :search.Summary.COUNT}
                            ]
                        }).run().each(function(result){
                            log.debug('result', result)
                            numberLeft = result.getValue({name:'internalid', summary :search.Summary.COUNT})
                        });
                        context.form.addPageInitMessage({
                            type: message.Type.INFORMATION,
                            title: 'A backend process is updating your tokens',
                            message: 'Additional configuration changes are not recommended until this process is completed.' +
                                '<p>There are <b>'+numberLeft+'</b> profiles remaining to be updated.</p>' +
                                '<p>To prevent you from making bad decisions the edit button has been temporally removed from this record.</p>'
                        });
                        context.form.removeButton({id:'edit'});
                    }
                    else
                    {
                        var results = search.create({
                            type: 'customrecord_authnet_tokens',
                            filters : [
                                ['custrecord_an_token_paymenttype', 'anyof', '@NONE@'],
                                "AND",
                                ['isinactive', 'is', 'F'],
                                "AND",
                                ['custrecord_an_token_pblkchn_tampered', 'is', 'F']
                            ]
                        }).run().getRange({
                            start: 0, //Index number of the first result to return, inclusive
                            end: 1 //Index number of the last result to return, exclusive
                        });
                        log.debug('results', results)
                        _.forEach(results, function (val) {
                            var upgradeLink = url.resolveScript({
                                scriptId: 'customscript_c9_authnet_screen_svc',
                                deploymentId: 'customdeploy_sac_authnet_screen_svc',
                                params: {updatetokenpaymenttype : true}
                            })
                            context.form.addPageInitMessage({
                                type: message.Type.WARNING,
                                title: 'A manual update your customers Payment Profiles / Tokens is required',
                                message: 'An updated is needed to support the added functionality of this release.' +
                                    '<p>You should <a target="_blank" href="'+upgradeLink+'">click this link</a> to initiate the batch processing of token updates.  You can do this at a time when other processes will not be impacted.</p>',
                                duration: 600000
                            });
                        });
                    }


                    try {
                        if (context.newRecord.getValue({fieldId: 'custrecord_an_show_versions'})) {
                            var o_currentVersion = https.get({
                                url: 'https://raw.githubusercontent.com/gocloud1001/netsuite-authorize.net-connect/master/FileCabinet/SuiteScripts/openSuite/netsuite-authnet/sac/AuthNet_lib.js'
                            });
                            var s_body = o_currentVersion.body;
                            var s_remoteVersion = s_body.match(/VERSION =(.*);/gm)[0].split("'")[1];
                            if (authNet.VERSION !== s_remoteVersion) {
                                context.form.addPageInitMessage({
                                    type: message.Type.WARNING,
                                    title: 'Your version of SuiteAuthConnect is not the current version',
                                    message: 'You are currently running version ' + authNet.VERSION + ' and the current released version is ' + s_remoteVersion + '.  You may want to consider updating your version if you are behind to ensure you have the latest bug fixes and added features.',
                                    duration: 60000
                                });
                            }
                        }
                    } catch (ex) {
                        log.error('Failed to validate version')
                    }
                }
                if (context.newRecord.getValue({fieldId: 'custrecord_an_version'}) !== authNet.VERSION
                    &&
                    !_.includes(['xedit', 'delete', 'create', 'copy'], context.type)
                ) {
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
                    } else {
                        log.audit('Updated by upgrade script this one time!', 'Not tryint to re-upgrade!');
                    }
                }
            }

        }
        function beforeSubmit(context) {

            if (_.includes(['create', 'copy'], context.type)){
                //if there are other config records - inactivate them!
                search.create({
                    type: 'customrecord_authnet_config',
                    filters: [],
                    columns: [
                        {name: 'name', sort: search.Sort.DESC}
                    ]
                }).run().each(function (result) {
                    var _recordlink = url.resolveRecord({
                        recordType: 'customrecord_authnet_config',
                        recordId: result.id
                    })
                    throw 'You can not create more than 1 Authorize.Net configuration within your account.<br /><br />   The configuration <i><a href="'+_recordlink+'">' + result.getValue('name') + '</a></i> already exists - click the link to review that configuration and/or update it.';
                });
            }

        }
        function afterSubmit(context) {
            log.debug('aftersubmit', context.type)
            var triggerUpdate = false;
            if (context.type === 'edit')
            {
                if (context.oldRecord.getValue({fieldId:'custrecord_an_all_sub'}) && !context.newRecord.getValue({fieldId:'custrecord_an_all_sub'}))
                {
                    //this account just flipped to a subsidiary configuration
                    //need to add a subsidiary record!
                    var o_subRec = record.create({
                        type: 'customrecord_authnet_config_subsidiary',
                        isDynamic : true
                    });
                    o_subRec.setValue({fieldId:'custrecord_ancs_parent_config', value :context.newRecord.id});
                    o_subRec.setValue({fieldId:'name', value : context.newRecord.getValue({fieldId:'name'}) + ' Subsidiary'});
                    if (context.newRecord.getValue({fieldId:'custrecord_an_login'}))
                    {
                        o_subRec.setValue({fieldId:'custrecord_ancs_active', value : true});
                    }
                    else
                    {
                        o_subRec.setValue({fieldId:'custrecord_ancs_active', value : false});
                    }

                    o_subRec.setValue({fieldId:'custrecord_ancs_login', value : context.newRecord.getValue({fieldId:'custrecord_an_login'})});
                    o_subRec.setValue({fieldId:'custrecord_ancs_trankey', value : context.newRecord.getValue({fieldId:'custrecord_an_trankey'})});
                    o_subRec.setValue({fieldId:'custrecord_ancs_login_sb', value : context.newRecord.getValue({fieldId:'custrecord_an_login_sb'})});
                    o_subRec.setValue({fieldId:'custrecord_ancs_trankey_sb', value : context.newRecord.getValue({fieldId:'custrecord_an_trankey_sb'})});
                    o_subRec.setValue({fieldId:'custrecord_ancs_txn_companyname', value : context.newRecord.getValue({fieldId:'custrecord_an_txn_companyname'})});
                    o_subRec.setValue({fieldId:'custrecord_ancs_subsidiary', value : context.newRecord.getValue({fieldId:'custpage_change_sub'})});
                    var i_newSubGateway = o_subRec.save({ignoreMandatoryFields : true});

                    //need to then clear eveything on the main record to not confuse the matter
                    record.submitFields({
                        type: context.newRecord.type,
                        id: context.newRecord.id,
                        values: {
                            'custrecord_an_islive': false,
                            'custrecord_an_login' : '',
                            'custrecord_an_trankey' : '',
                            'custrecord_an_trankey_sb' : '',
                            'custrecord_an_txn_companyname' : '',
                            'custrecord_an_devicetype' : '',
                            'custrecord_an_marketype' : '',
                        }
                    });
                    //now we need to update all the existing tokens in the system to this subsidiary
                    var o_params = {
                        custscript_an_gateway_sub : i_newSubGateway,
                        custscript_an_subsidiary : context.newRecord.getValue({fieldId:'custpage_change_sub'})
                    };
                    log.debug('o_params',o_params);
                    //launch map/reduce task here
                    var scriptTask = task.create({
                        taskType : task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_sac_update_profiles',
                        deploymentId: 'customdeploy_sac_update_profiles',
                        params : o_params
                    });
                    scriptTask.submit();

                }
            }

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
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });