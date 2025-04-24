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
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @NScriptType UserEventScript
 *
 * @NAmdConfig ../config.json
 */


define(['N/record', 'N/url', 'N/https', 'N/runtime', 'N/redirect', 'N/ui/serverWidget', 'N/ui/message', 'N/cache', 'N/task', 'N/search', 'lodash', 'moment', './AuthNet_lib', './click2pay/AuthNet_click2Pay_lib21'],
    function (record, url, https, runtime, redirect, ui, message, cache, task, search, _, moment, authNet, authNetC2P) {

        function beforeLoad(context) {
            //make all this UI only
            cache.getCache(
                {
                    name: 'config',
                    scope: cache.Scope.PROTECTED
                }
            );
            log.audit('Cache Gotten', 'Loading the config, so cache gotten for sure');
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
                var fld_subcprefix = context.form.addField({
                    id: 'custpage_change_sub_prefix',
                    label: 'Subsidiary Card Prefix (3 letters max)',
                    type: ui.FieldType.TEXT,
                });
                context.form.insertField({
                    field: fld_subcprefix,
                    nextfield: 'custrecord_an_all_sub'
                });
                if (!context.newRecord.getValue({fieldId: 'custrecord_an_all_sub'}) || context.type === 'view') {
                    fld_subconfig.updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    fld_subcprefix.updateDisplayType({
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
                        //NS does not provide a real API for this - so DOM hack required
                        _.forEach(context.form.getTabs(), function(tabid){
                            var subtab = context.form.getTab({
                                id : tabid});
                            if (subtab.label === "Subsidiary Configuration")
                            {
                                var fld_hideScript = context.form.addField({
                                    id : 'custpage_hide_sub_tab',
                                    type : ui.FieldType.INLINEHTML,
                                    label : '.'
                                });
                                fld_hideScript.defaultValue = "<script>jQuery(window).on('load', function() {\n" +
                                    " jQuery('#"+tabid+"_div').css('display', 'none');" +
                                    " jQuery('#"+tabid+"lnk').css('display', 'none');" +
                                    "});</script>"
                                subtab.displayType = ui.SublistDisplayType.HIDDEN;
                            }
                        });
                    }
                    if (!context.newRecord.getValue({fieldId: 'custrecord_an_enable'})) {
                        context.form.addPageInitMessage({
                            type: message.Type.INFORMATION,
                            title: 'ENABLE CONFIGURATION is NOT Checked',
                            message: 'This means no transaction (either using production OR sandbox credentials) will process in your NetSuite account.<br/>' +
                                'This is fine if you are not yet ready to enable the configuration throughout NetSuite.'
                        });
                    }
                    if(runtime.isFeatureInEffect({feature: 'multisubsidiarycustomer'}) && context.newRecord.getValue({fieldId: 'custrecord_an_all_sub'}))
                    {
                        context.form.addPageInitMessage({
                            type: message.Type.ERROR,
                            title: 'Your system is configured to allow Multi Subsidiary Customer',
                            message: 'Your system has Multi Subsidiary Customer enabled (<i>Setup > Enable Features >> Company >>> ERP General</i>)<br>This feature REQUIRES you to enable multiple subsidiary support in the Authorize.Net Configuration. (Sometimes this is set on accounts and never used, if you are not using this NetSuite feature, do yourself a favor and just disable it, return to this page, click the "Debug & Testing Tool" link at the bottom of this screen and select the Purge Cache" option)<br/>' +
                                'To configure The SuiteAuthConnect Authorize.Net connector to operate in this environment, you must uncheck the box "Use for all Subsidaries" in the configuration on this screen and follow the prompts.<br/>' +
                                'You must fully configure at least one subsidary as well on this screen. You can use the same authorize.net credentails / processing gateway for all your subsadaries if you want, although that would be odd.<br/>' +
                                '<i>(If you are upgrading versions and now enabling this, all your existing tokens will be missing the new prefix used to distinguish subsidaries apart. This is purely cosmetic but may be confusing for selecting the correct cards.)',
                            //duration: 0
                        });
                    }
                    if (!runtime.isFeatureInEffect({ feature: 'extcrm' }))
                    {
                        context.form.addPageInitMessage({
                            type: message.Type.WARNING,
                            title: 'Configuration Missing for Click2Pay Feature',
                            message: 'Before enabling the Click 2 Pay feature, you must enable the Online Forms feature in NetSuite.  Navigate to Setup > Company > Enable Features >> CRM tab and select Online Forms under the Marketing section.',
                            //duration: 0
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
                                //duration: 60000
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
                                        //duration: 60000
                                    });
                                }
                            }
                        }

                    } else {
                        log.audit('Valudating non-sub config', 'Checking credentials');
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
                                //duration: +o_testResult.level === 3 ? 0 : 6000
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
                                //duration: +o_testResult.level === 3 ? 0 : 6000
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
                    /*else
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
                        //log.debug('results', results)
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
                                    '<p>Only proceed in this message if there are no other messages or warnings displayed</p>' +
                                    '<p>You should <a target="_blank" href="'+upgradeLink+'">click this link</a> to initiate the batch processing of token updates.  You can do this at a time when other processes will not be impacted.</p>',
                            });
                        });
                    }*/


                    try {
                        if (context.newRecord.getValue({fieldId: 'custrecord_an_show_versions'})) {
                            var o_currentVersion = https.get({
                                url: 'https://raw.githubusercontent.com/gocloud1001/netsuite-authorize.net-connect/master/FileCabinet/SuiteScripts/openSuite/netsuite-authnet/sac/AuthNet_lib.js'
                            });
                            var s_body = o_currentVersion.body;
                            var s_remoteVersion = s_body.match(/VERSION =(.*);/gm)[0].split("'")[1];
                            log.audit('Remote version on GitHub', s_remoteVersion);
                            if (authNet.VERSION !== s_remoteVersion) {
                                //ok - not a match - now lets figure out which way
                                var a_remote = s_remoteVersion.split('.');
                                var a_local = authNet.VERSION.split('.');
                                if (a_remote.length !== 3)
                                {
                                    context.form.addPageInitMessage({
                                        type: message.Type.ERROR,
                                        title: 'Your version of SuiteAuthConnect is OUT OF DATE',
                                        message: 'You are currently running version ' + authNet.VERSION + ' and the current released version is ' + s_remoteVersion + '.  You SHOULD upgrade as the version you are running has had several critical bugs fixed AND contains components that have been EOLed by NetSuite.',
                                        //duration: 60000
                                    });
                                }
                                else
                                {
                                    log.debug(a_remote[0] , a_local[0])
                                    if (+a_remote[0] < +a_local[0] || +a_remote[1] < +a_local[1] || +a_remote[2] < +a_local[2] || a_local[3])
                                    {
                                        context.form.addPageInitMessage({
                                            type: message.Type.CONFIRMATION,
                                            title: 'You are running a pre-release version of SuiteAuthConnect',
                                            message: 'You are currently running version ' + authNet.VERSION + ' and the current released version is ' + s_remoteVersion + '.  You are running a pre-release, edge, or hot fix version of SuiteAuthConnect.',
                                            //duration: 60000
                                        });
                                    }
                                    else if (+a_remote[0] > +a_local[0])
                                    {
                                        context.form.addPageInitMessage({
                                            type: message.Type.WARNING,
                                            title: 'Your version of SuiteAuthConnect is not the current version',
                                            message: 'You are currently running version ' + authNet.VERSION + ' and the current released version is ' + s_remoteVersion + '.  You should strongly consider updating your version as you are behind a major revision to ensure you have the latest bug fixes and added features.',
                                            //duration: 60000
                                        });
                                    }
                                    else if (+a_remote[1] > +a_local[1])
                                    {
                                        context.form.addPageInitMessage({
                                            type: message.Type.WARNING,
                                            title: 'Your version of SuiteAuthConnect is not the current version',
                                            message: 'You are currently running version ' + authNet.VERSION + ' and the current released version is ' + s_remoteVersion + '.  You should consider updating as you are behind a minor revision to ensure you have the latest bug fixes and added features.',
                                            //duration: 60000
                                        });
                                    }
                                    else if (+a_remote[2] > +a_local[2])
                                    {
                                        context.form.addPageInitMessage({
                                            type: message.Type.INFORMATION,
                                            title: 'Your version of SuiteAuthConnect is not the current version',
                                            message: 'You are currently running version ' + authNet.VERSION + ' and the current released version is ' + s_remoteVersion + '.  You should consider updating to receive the latest bug fixes and added features.',
                                            //duration: 60000
                                        });
                                    }
                                }
                            }
                        }
                    } catch (ex) {
                        log.error('Failed to validate version')
                    }
                }
                log.debug(context.type + ' : ' + context.newRecord.getValue({fieldId: 'custrecord_an_version'}).toString() +':'+_.isUndefined(context.newRecord.getValue({fieldId: 'custrecord_an_version'})), authNet.VERSION)
                if (
                    (!_.isUndefined(context.newRecord.getValue({fieldId: 'custrecord_an_version'})) && (context.newRecord.getValue({fieldId: 'custrecord_an_version'}).toString() !== authNet.VERSION))
                    &&
                    !_.includes(['xedit', 'delete', 'create', 'copy'], context.type)
                    /*||
                    //this is for a weird thing that happens when enabling multi sub
                    _.isUndefined(context.newRecord.getValue({fieldId: 'custrecord_an_version'}))*/
                ) {
                    if (!context.newRecord.getValue({fieldId: 'custrecord_an_skip_on_save'})) {
                        try {
                            context.form.addPageInitMessage({
                                type: message.Type.INFORMATION,
                                title: 'SYSTEM IS UPDATING CONFIGURATION',
                                message: 'Your configuration is updating, please refresh this page until this message is gone before making any changes.',
                            });
                            context.form.removeButton({id:'edit'});
                            var scriptTask = task.create({
                                taskType: task.TaskType.SCHEDULED_SCRIPT,
                                scriptId: 'customscript_sac_ss2_update_cfg',
                                deploymentId: 'customdeploy_sac_ss2_update_cfg_o'
                            });
                            var scriptTaskId = scriptTask.submit();
                            //log.debug('scriptTaskId', scriptTaskId)
                            log.audit('Process for initial setup / update is running ', task.checkStatus(scriptTaskId));
                        } catch (ex) {
                            log.emergency(ex.name, ex.message);
                        }
                    } else {
                        log.audit('Updated by upgrade script this one time!', 'Not tryint to re-upgrade!');
                    }
                }
                if (context.newRecord.getValue({fieldId: 'custrecord_an_enable_click2pay_inv'}))
                {
                    try {
                        authNetC2P.crypto.encrypt(context.newRecord.id, 'custsecret_authnet_payment_link');
                    }
                    catch(ex)
                    {
                        log.error(ex.name, ex.message);
                        log.error(ex.name, ex.name === 'INVALID_SECRET_KEY_LENGTH');
                        if (ex.name === 'INVALID_SECRET_KEY_LENGTH') {
                            context.form.addPageInitMessage({
                                type: message.Type.ERROR,
                                title: 'Error Enabling Click2Pay',
                                message: 'Please update your API Secret via <a target="_blank" href="/app/common/scripting/secrets/settings.nl?whence=">Setup > Company > API Secrets.</a><br>' +
                                    ex.message + '<br>Here is a 32 character string you could use as your password : '+_.times(32, () => _.random(35).toString(36)).join(''),
                            });
                        }
                        else
                        {
                            context.form.addPageInitMessage({
                                type: message.Type.ERROR,
                                title: 'Click2Pay Configuration Error',
                                message: 'Please update your API Secret via Setup > Company > API Secrets.<br>' +
                                    ex.name + '<br>' + ex.message,
                            });
                        }
                        context.newRecord.setValue({fieldId: 'custrecord_an_enable_click2pay_inv', value : false});
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
            let o_config2 = authNet.getConfigFromCache();
            authNet.verboseLogging('aftersubmit cache', o_config2);
            let b_purgeCache = false;
            if (context.type === 'edit')
            {
                //if (context.oldRecord.getValue({fieldId:'custrecord_an_all_sub'}) && !context.newRecord.getValue({fieldId:'custrecord_an_all_sub'}))
                //load this record to see if the enable sub is checked
                let o_configRec = record.load({
                    type: 'customrecord_authnet_config',
                    id: o_config2.id,
                });
                log.debug(context.oldRecord.getValue({fieldId:'custrecord_an_all_sub'}) , !o_configRec.getValue({fieldId:'custrecord_an_all_sub'}))
                if (context.oldRecord.getValue({fieldId:'custrecord_an_all_sub'}) && !o_configRec.getValue({fieldId:'custrecord_an_all_sub'}) && o_config2.mode === 'single')
                {
                    log.audit('Multi Sub Activated', 'Multi Sub Behavior Was just ENABLED!');
                    b_purgeCache = true;
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
                    o_subRec.setValue({fieldId:'custrecord_ancs_card_prefix', value : context.newRecord.getValue({fieldId:'custpage_change_sub_prefix'})});
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
                        custscript_an_subsidiary : context.newRecord.getValue({fieldId:'custpage_change_sub'}),
                        custscript_change_sub_prefix : context.newRecord.getValue({fieldId:'custpage_change_sub_prefix'}),
                    };
                    authNet.verboseLogging('o_params for map/reduce to update the payment methods',o_params);
                    //launch map/reduce task here
                    var scriptTask = task.create({
                        taskType : task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_sac_update_profiles',
                        deploymentId: 'customdeploy_sac_update_profiles',
                        params : o_params
                    });
                    log.audit('Launching Token Update', 'Updating all the tokens with multi SUB');
                    scriptTask.submit();
                }
            }

            if (_.includes(['create', 'edit', 'xedit'], context.type)
            &&
                (!context.newRecord.getValue({fieldId: 'custrecord_an_skip_on_save'})
                    ||
                    b_purgeCache)
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