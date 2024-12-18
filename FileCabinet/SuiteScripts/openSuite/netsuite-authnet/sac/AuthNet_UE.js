/**
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
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope Public
 *
 * @NAmdConfig ../config.json
 */


define(['N/record', 'N/plugin', 'N/runtime', 'N/error', 'N/search', 'N/log', 'N/ui/serverWidget', 'N/ui/message', 'N/redirect', 'lodash', './AuthNet_lib', './AuthNet_UI_lib', 'moment', './click2pay/AuthNet_click2Pay_lib21'],
    function (record, plugin, runtime, error, search, log, ui, message, redirect, _, authNet, authNetUI, moment, authNetC2P) {
        function authNetBeforeLoad(context) {
            log.audit('STARTING authNetBeforeLoad via : '+runtime.executionContext, context.type +' on '+context.newRecord.type);
            if (runtime.executionContext === runtime.ContextType.USER_INTERFACE) {
                var form = context.form;
                if (runtime.getCurrentScript().getParameter({name:'custscript_sac_debug_logs'}) === 'Y')
                {
                    context.form.addPageInitMessage({
                        type: message.Type.WARNING,
                        title: 'Authorize.Net Script Enhanced Logging Enabled',
                        message: 'This script deployment ('+runtime.getCurrentScript().deploymentId+') has "Enable Debugging Logs - NON-PCI Compliant!" enabled and may be logging non-PCI compliant data to the logs as well as other PII.  You should confirm you want this behavior enabled with an Administrator before entering any credit card or other sensitive data.'
                    });
                }

                var o_config2 = authNet.getConfigFromCache();
                //now switch the object to the correct sub config!
                if (o_config2.mode === 'subsidiary'){
                    if (context.newRecord.getValue({fieldId : 'subsidiary'}))
                    {
                        let o_config = authNet.getSubConfig(context.newRecord.getValue({fieldId : 'subsidiary'}), o_config2);
                        if (!_.isEmpty(o_config))
                        {
                            o_config2 = o_config;
                        }
                        else
                        {
                            log.audit('Multi-Sub, non-participating sub or unknown sub', 'There will be no initial Auth.Net activity on this record because the sub does not match or it is unknown (like on a create)');
                        }
                    }
                }
                form = authNetUI.notSetUpErrorCheck(form, o_config2);
                if (_.isUndefined(o_config2) || _.isEmpty(o_config2))
                {
                    return;
                }

                //if we have transaction records that the auth net fields appear on but shouldn't - do this
                if(_.includes(['invoice'], context.newRecord.type))
                {
                    _.forEach(_.concat(authNet.ALLAUTH,), function (fd) {
                        var fld = 'custbody_authnet_' + fd;
                        try {
                            form.getField({id: fld}).updateDisplayType({
                                displayType: ui.FieldDisplayType.HIDDEN
                            });
                        } catch (e){
                            //log.error('Field Not on Form', form + ' missing ' + fld)
                        }
                    });
                    if (context.type === context.UserEventType.COPY) {
                        _.forEach(authNet.CLICK2PAY, function (fd)
                        {
                            var fld = 'custbody_authnet_c2p_' + fd;
                            try {
                                context.newRecord.setValue({fieldId: fld, value: ''});
                            } catch (e) {
                                //log.error('Field Not on Form', form + ' missing ' + fld)
                            }
                        });
                    }
                    _.forEach(form.getTabs(), function(tabid){
                        var subtab = context.form.getTab({
                            id : tabid});
                        if (subtab.label === "Authorize.Net")
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
                    log.audit('This record has nothing to do with authorize.net','So all fields are hidden and it is skipped.')

                    //add logic for the click 2 Pay behaviors here
                    if (context.type === 'view' && context.newRecord.getValue({fieldId : 'custbody_authnet_c2p_url'}))
                    {
                        if(context.newRecord.getValue({fieldId: 'status'}) === 'Open') {
                            if (context.newRecord.getValue({fieldId: 'custbody_authnet_c2p_most_recent_open'})) {
                                var maxResults = 6, counter = 0;
                                var s_message = 'Most recent customer views:<p><ul style="list-style-type: circle;list-style-position: inside;">'
                                search.create({
                                    type: 'invoice',
                                    filters: [
                                        ['type', 'anyof', ["CustInvc"]],
                                        "AND",
                                        ['internalid', 'anyof', [context.newRecord.id]],
                                        "AND",
                                        ['systemnotes.field', 'anyof', ["CUSTBODY_AUTHNET_C2P_MOST_RECENT_OPEN"]],
                                        "AND",
                                        ['mainline', 'is', ["T"]]
                                    ],
                                    columns:
                                        [
                                            {name: "newvalue", join: "systemNotes"},
                                            {name: "date", join: "systemNotes", sort: 'DESC'},
                                        ]
                                }).run().each(function (result)
                                {
                                    //log.debug('result', result);
                                    if (counter < maxResults) {
                                        s_message += '<li>Viewed on : ' + result.getValue({
                                            name: "newvalue",
                                            join: "systemNotes"
                                        }) + '</li>';
                                    }
                                    counter++;
                                    return true;
                                });
                                if (counter > maxResults) {
                                    s_message += '<li>' + (counter - maxResults) + ' more results...</li></ul>'
                                    s_message += 'View full history under Notes > System Notes'
                                } else {
                                    if (counter === 0) {
                                        s_message += '<li>Viewed on : ' + context.newRecord.getValue({fieldId: 'custbody_authnet_c2p_most_recent_open'}) + '</li>'
                                    }
                                    s_message += '</ul>';
                                }
                                s_message += '</p>';
                                context.form.addPageInitMessage({
                                    type: message.Type.CONFIRMATION,
                                    title: 'Invoice Click2Pay Viewing History',
                                    message: s_message
                                });
                            } else {
                                context.form.addPageInitMessage({
                                    type: message.Type.INFORMATION,
                                    title: 'Invoice has not been viewed',
                                    message: 'The customer has not yet viewed this invoice'
                                });
                            }
                        }
                    }
                    if ((o_config2.custrecord_an_enable_click2pay_inv && !o_config2.custrecord_an_enable_click2pay_inv.val) || !o_config2.custrecord_an_enable_click2pay_inv)
                    {
                        _.forEach(authNet.CLICK2PAY, function (fd) {
                            var fld = 'custbody_authnet_c2p_' + fd;
                            try {
                                form.getField({id: fld}).updateDisplayType({
                                    displayType: ui.FieldDisplayType.HIDDEN
                                });
                            } catch (e){
                                log.error('Field Not on Form', form + ' missing ' + fld)
                            }
                        });
                        /*try {
                            form.addField({
                                id: 'custpage_noclick2pay',
                                label: 'test',
                                type: ui.FieldType.EMAIL,
                                container: 'custtab_authnet_clicktopay'
                            });
                        } catch(e)
                        {
                            log.error(e.name, e.message);
                        }*/
                    }
                    return;
                }
                else
                {
                    //find and hide the click 2 pay tab on anything except Invoices
                    _.forEach(authNet.CLICK2PAY, function (fd) {
                        var fld = 'custbody_authnet_c2p_' + fd;
                        try {
                            form.getField({id: fld}).updateDisplayType({
                                displayType: ui.FieldDisplayType.HIDDEN
                            });
                        } catch (e){
                            //log.error('Field Not on Form', form + ' missing ' + fld)
                        }
                    });
                    /*_.forEach(form.getTabs(), function(tabid){
                        var subtab = context.form.getTab({
                            id : tabid});
                        if (subtab.label === "Authorize.Net Click2Pay")
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
                    });*/
                }
                if(_.includes(['creditmemo'], context.newRecord.type))
                {
                    _.forEach(_.concat(authNet.ALLAUTH, authNet.TOKEN, authNet.CHECKBOXES), function (fd) {
                        var fld = 'custbody_authnet_' + fd;
                        try {
                            form.getField({id: fld}).updateDisplayType({
                                displayType: ui.FieldDisplayType.INLINE
                            });
                        } catch (e){
                            //log.error('Field Not on Form', form + ' missing ' + fld)
                        }
                    });
                    log.audit('This record has nothing to do with authorize.net','So all fields are hidden and it is skipped.')
                    return;
                }
                //set the auth free config objct in the custom field for the client scripts to know what to do!
                form = authNetUI.buildConfigField(form, o_config2);
                //added field for holding on page information that does not need to be saved
                form.addField({
                    id: 'custpage_sac_ui_data',
                    type: ui.FieldType.LONGTEXT,
                    label: 'SAC TEMP UI DATA'
                }).updateDisplayType({
                    displayType: ui.FieldDisplayType.HIDDEN
                }).defaultValue = '{}';

                //Is any of this turned on?
                if (!o_config2.custrecord_an_enable.val) {
                    form.getField({id: 'custbody_authnet_use'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    form.getField({id: 'custbody_authnet_override'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    _.forEach(authNet.ALLAUTH, function (fd) {
                        var fld = 'custbody_authnet_' + fd;
                        try {
                            form.getField({id: fld}).updateDisplayType({
                                displayType: ui.FieldDisplayType.HIDDEN
                            });
                        } catch (e){
                            //log.error('Field Not on Form', form + ' missing ' + fld)
                        }
                    });
                    return;
                }
                //these fields are legacy fields that should always be hidden
                _.forEach(authNet.CCFIELDS, function (fd) {
                    var fld = 'custbody_authnet_' + fd;
                    try {
                        form.getField({id: fld}).updateDisplayType({
                            displayType: ui.FieldDisplayType.HIDDEN
                        });
                    } catch (e){
                        //log.error('Field Not on Form', form + ' missing ' + fld)
                    }
                });

                var fldWarning = form.addField({
                    id: 'custpage_c9_error',
                    type: ui.FieldType.INLINEHTML,
                    label: 'WARNING'
                });

                fldWarning.updateLayoutType({
                    layoutType: ui.FieldLayoutType.OUTSIDEABOVE
                });
                fldWarning.updateBreakType({
                    breakType: ui.FieldLayoutType.STARTROW
                });

                var s_field = '<div class="uir-alert-box %TYPE%" width="100%">' +
                    '<div class="icon %TYPE%">' +
                    '<img src="/images/icons/messagebox/icon_msgbox_%TYPE%.png" alt="">' +
                    '</div>' +
                    '<div class="content">' +
                    '<div class="title">%TITLE%</div>' +
                    '<div class="descr">%DESCR%</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>';



                if (!_.includes([context.UserEventType.CREATE, context.UserEventType.DELETE], context.type) )
                {
                    //moved the history parser here and if it's not good - run another status check / log generation
                    var o_history = authNet.parseHistory(context.newRecord.id, context.newRecord.type, (context.newRecord.getValue({fieldId :'custbody_authnet_use'}) || !_.isEmpty(context.newRecord.getValue({fieldId :'custbody_authnet_refid'}))))
                    if(!o_history.isValid && o_history.historyId) {
                        //will not rerun for customer payments...
                        try {
                            //make a new log with the current status check of this transaction
                            authNet.getStatus(context.newRecord, 'getTransactionDetailsRequest');
                        } catch (e) {
                            log.error(e.name, e.message);
                        }
                        //todo - make this do customer payments too?
                    }

                    //some general variables here
                    var b_overide = context.newRecord.getValue({fieldId :'custbody_authnet_override'}),
                        b_pendingAuthNoError = context.newRecord.getValue({fieldId :'orderstatus'}) === 'A' && (o_config2.custrecord_an_auth_so_on_approval && o_config2.custrecord_an_auth_so_on_approval.val),
                        b_responseFailure = (context.newRecord.getValue({fieldId: 'custbody_authnet_error_status'}) || !o_history.isValid),
                        b_hasToken = (+context.newRecord.getValue('custbody_authnet_cim_token') !== 0 && !_.isNaN(+context.newRecord.getValue('custbody_authnet_cim_token'))),
                        //this is only auth net if theres an auth net payment method (for this banner)
                        b_isAuthNet = ((context.newRecord.getValue({fieldId :'custbody_authnet_use'})
                            || context.newRecord.getValue({fieldId: 'custbody_authnet_error_status'}) )
                            && _.includes([o_config2.custrecord_an_paymentmethod.val, o_config2.custrecord_an_paymentmethod_echeck.val], context.newRecord.getValue({fieldId: (o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod')})));
                    //log.debug(context.newRecord.getValue({fieldId :'orderstatus'}), o_config2.custrecord_an_auth_so_on_approval.val)
                    authNet.verboseLogging('history parsed', o_history);
                    //authNet.verboseLogging('b_isAuthNet', b_isAuthNet);
                    //authNet.verboseLogging('thisRecord.getValue(\'orderstatus\')', context.newRecord.getValue('orderstatus'));
                    //authNet.verboseLogging('b_responseFailure', b_responseFailure);
                    //authNet.verboseLogging('custbody_authnet_done', context.newRecord.getValue({fieldId:'custbody_authnet_done'}));
                    if (b_pendingAuthNoError)
                    {
                        log.audit('No Error Display', 'This SO is pending approval and the config has the setting "Perform Authorization On Approval of Sales Order Not Create/Save"');
                    }
                    else if (!b_overide)
                    {
                        if (b_responseFailure && b_isAuthNet)
                        {
                            var s_title = '';
                            if (context.newRecord.getValue({fieldId:'custbody_authnet_authcode'}) === '(IMPORTED)'){
                                s_title = 'IMPORTED AUTH : ';
                            }
                            s_title += o_history.status + ' ' + o_history.errorCode;
                            context.form.addPageInitMessage({
                                type: message.Type.ERROR,
                                title: s_title,
                                message: o_history.message
                            });
                        }
                        else if (o_history.showBanner)
                        {
                            //this is used if the transaction passes but has some sort of pending issue
                            context.form.addPageInitMessage({
                                type: message.Type.WARNING,
                                title: o_history.responseCodeText,
                                message: o_history.message
                            });
                        }
                    }
                    _.forEach(authNet.CCFIELDS, function (fd) {
                        var fld = 'custbody_authnet_' + fd;
                        try {
                            form.getField({id: fld}).updateDisplayType({
                                displayType: ui.FieldDisplayType.HIDDEN
                            });
                        } catch (e){
                            //log.error('Field Not on Form', form + ' missing ' + fld)
                        }
                    });

                    //if this is a view - make the cc fields hidden for cleanness
                    if (context.type === context.UserEventType.VIEW){
                        _.forEach(_.concat(authNet.CCENTRY, authNet.TOKEN), function (fd) {
                            var fld = 'custbody_authnet_' + fd;
                            try {
                                if (b_hasToken && b_isAuthNet && fld === 'custbody_authnet_cim_token'){
                                    //skip hiding the token
                                }
                                else {
                                    form.getField({id: fld}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.HIDDEN
                                    });
                                }
                            } catch (e){
                                //log.error('Field Not on Form', form + ' missing ' + fld)
                            }
                        });
                    }
                    if (context.type === context.UserEventType.COPY){
                        authNet.homeSysLog('CLEANING Auth values', 'This is a copy!');
                        var objRecord = context.newRecord;
                        _.forEach(authNet.ALLAUTH, function (fd) {
                            var fld = 'custbody_authnet_' + fd;
                            try {
                                objRecord.setValue({fieldId: fld, value: ''});
                            } catch (e){
                                //log.error('Field Not on Form', form + ' missing ' + fld)
                            }
                        });
                        _.forEach(authNet.CODES, function (fd) {
                            var fld = 'custbody_authnet_' + fd;
                            try {
                                form.getField({id: fld}).updateDisplayType({
                                    displayType: ui.FieldDisplayType.HIDDEN
                                });
                            } catch (e){
                                //log.error('Field Not on Form', form + ' missing ' + fld)
                            }
                        });
                        _.forEach(['custbody_authnet_use', 'paymentmethod', 'paymentoption', 'custbody_authnet_override'], function (fld) {
                            try {
                                objRecord.setValue({fieldId: fld, value: ''});
                            } catch (e){
                                //log.error('Field Not on Form', form + ' missing ' + fld)
                            }
                        });
                    }

                    switch (context.newRecord.type) {
                        case 'salesorder':
                            //if this is a copy - we need to delete ALL the values in the field for credit card
                            var thisRecord = context.newRecord;
                            /*record.load({
                                type: context.newRecord.type,
                                id: context.newRecord.id,
                                isDynamic: true
                            });*/
                            //some people have cc native and some do not - this prevents double billing anything
                            try{
                                if (thisRecord.getValue('pnrefnum') || thisRecord.getValue('authcode')){
                                    thisRecord.setValue({fieldId :'custbody_authnet_use', value :false});
                                    form.getField({id: 'custbody_authnet_use'}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.DISABLED
                                    });
                                }
                                form.getField({id: 'custbody_authnet_override'}).updateDisplayType({
                                    displayType: ui.FieldDisplayType.HIDDEN
                                });
                            } catch(ex){

                            }

                            //always hide the close button becasue of creditcard stuff
                            //form.removeButton({id: 'closeremaining'});
                            //if this is an authnet record - do tests otherwise - ship tests
                            if(b_isAuthNet) {
                                //log.debug(b_responseFailure, b_hasToken + ' ' + s_paymentVehicle)
                                if (b_hasToken && thisRecord.getValue('orderstatus') === 'A') {
                                    //there's no error - theres a token and it's not been run, so no response failure
                                    b_responseFailure = false;
                                    log.audit('This Transaction is Pending Approval', 'Displaying any error has been supressed becasue this is not done yet!');
                                }
                                if ((b_responseFailure && thisRecord.getValue({fieldId: (o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod')}) === o_config2.custrecord_an_paymentmethod.val))
                                {
                                    context.newRecord.setValue({fieldId: 'custbody_authnet_use', value: false});
                                    //context.newRecord.setValue({fieldId :'memo', value :'hi there - big time'});
                                    s_field = s_field.replace(/%TYPE%/g, 'error');
                                    if (+o_history.responseCode === 4)
                                    {
                                        s_field = s_field.replace('%TITLE%', 'Payment Error - Suspected Fraud');
                                        s_field = s_field.replace('%DESCR%', o_history.responseCodeText + '<br/> Review the Authorize.net History record to approve or decline this pending authorization.');
                                        fldWarning.defaultValue = s_field;
                                    }
                                    //dont really need 2 boxes screaming at you for anything except the odd fraud issue
                                    /*else
                                    {
                                        s_field = s_field.replace('%TITLE%', s_paymentVehicle + ' Payment Error');
                                        s_field = s_field.replace('%DESCR%', o_history.message);
                                    }*/
                                    //fldWarning.setDefaultValue(s_field);

                                    //do not allow approval as SO does not have captured funds
                                    form.removeButton({id: 'approve'});
                                    form.removeButton({id: 'nextbill'});
                                    form.removeButton({id: 'billremaining'});
                                    //todo - remove cancel call to auth net if no auth
                                }
                                else if (!_.isEmpty(thisRecord.getValue('custbody_authnet_authcode')))
                                {
                                    form.removeButton({id: 'void'});
                                    //dont let people uncheck the check mark now!
                                    try {
                                        form.getField({id: 'custbody_authnet_use'}).updateDisplayType({
                                            displayType: ui.FieldDisplayType.DISABLED
                                        });
                                        form.getField({id: (o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod')}).updateDisplayType({
                                            displayType: ui.FieldDisplayType.DISABLED
                                        });
                                    } catch (e) {
                                        //log.error('Native CC Field Not on Form', form + ' missing ' + 'paymentmethod')
                                    }

                                    _.forEach(authNet.CCENTRY, function (fd) {
                                        var fld = 'custbody_authnet_' + fd;
                                        try {
                                            if (b_hasToken && b_isAuthNet && fld === 'custbody_authnet_cim_token'){
                                                //skip hiding the token
                                            }
                                            else {
                                                form.getField({id: fld}).updateDisplayType({
                                                    displayType: ui.FieldDisplayType.HIDDEN
                                                });
                                            }
                                        } catch (e) {
                                            //log.error('Field Not on Form', form + ' missing ' + fld)
                                        }
                                    });
                                    //if there is a token on this approved and used record - leave it visable in view
                                    if (b_hasToken){
                                        //if it worked and is a token - make sure the token field is shown in view...
                                        form.getField({id: 'custbody_authnet_cim_token'}).updateDisplayType({
                                            displayType: ui.FieldDisplayType.NORMAL
                                        });
                                    }
                                }
                            }
                            break;
                        case 'cashrefund':
                        case 'customerrefund':
                            if (!context.newRecord.getValue({fieldId :'custbody_authnet_override'}))
                            {
                                if(!context.newRecord.getValue({fieldId:'custbody_authnet_done'}) && (context.newRecord.getValue({fieldId :'custbody_authnet_use'}) || context.newRecord.getValue({fieldId: (o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod')})) === o_config2.custrecord_an_paymentmethod.val) {
                                    if (!o_history.isValid) {
                                        log.error('parsehistory ERROR : customerrefund', o_history);
                                        context.form.addPageInitMessage({
                                            type: message.Type.ERROR,
                                            title: 'Refund Error',
                                            message: o_history.message
                                        });
                                    }
                                }
                            }
                            try {
                                form.removeButton({
                                    id: 'void'
                                });
                            } catch (e){
                                //no log - who cares?
                            }
                            break;
                        case 'cashsale':
                            if (!context.newRecord.getValue({fieldId :'custbody_authnet_override'}))
                            {
                                if (!context.newRecord.getValue({fieldId: 'custbody_authnet_done'}) && (context.newRecord.getValue({fieldId: 'custbody_authnet_use'}) || context.newRecord.getValue({fieldId: (o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod')})) === o_config2.custrecord_an_paymentmethod.val) {
                                    //var o_history = authNet.parseHistory(context.newRecord.id, context.newRecord.type);
                                    if (!o_history.isValid) {
                                        log.error('parsehistory ERROR : cashsale', o_history);
                                        //fldWarning.defaultValue = s_field;
                                        context.form.addPageInitMessage({
                                            type: message.Type.ERROR,
                                            title: 'Error',
                                            message: o_history.message
                                        });
                                    }
                                }
                            }
                            try {
                                form.removeButton({
                                    id: 'void'
                                });
                            } catch (e){
                                //no log - who cares?
                            }
                            break;

                        case 'customerdeposit':
                            //log.debug('b4laod','customerdeposit')
                            if (context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}) && context.newRecord.getValue({fieldId: 'custbody_authnet_datetime'})){
                                //form.removeButton({
                                //    id: 'delete'
                                //});
                                //check for date and if this could have settled - remove the void button
                                authNet.homeSysLog('auth time', context.newRecord.getValue({fieldId:'custbody_authnet_datetime'}))
                                var m_authDate = moment(context.newRecord.getValue({fieldId:'custbody_authnet_datetime'}), 'MM/DD/YYYY hh:mm:ss a');
                                var m_midnight = moment().endOf('day').subtract(59, 'seconds');
                                //if we can void - we void
                                if (m_authDate > m_midnight) {
                                    form.removeButton({
                                        id: 'void'
                                    });
                                }
                            }
                            break;
                        default:
                            break;
                    }
                    if (context.newRecord.getValue('custbody_authnet_override')){
                        context.form.addPageInitMessage({
                            type: message.Type.WARNING,
                            title: 'Authorize.Net Override Checked',
                            message: 'This transaction will not process via Authorize.Net and will not make any further calls to Authorize.Net'
                        });
                    }
                    if (context.newRecord.getValue('custbody_authnet_settle_status') === 'voided'){
                        context.form.addPageInitMessage({
                            type: message.Type.WARNING,
                            title: 'Authorize.Net Settlement Status is VOIDED',
                            message: 'This transaction has a status of VOIDED and therefore will never capture funds.  You should either delete this transaction, mark it voided if allowed, or issue a reversal (refund) of this in NetSuite to ensure you are not overstating revenue.'
                        });
                    }

                }
                else if (context.type === context.UserEventType.CREATE && context.newRecord.type === 'cashrefund' && (!context.newRecord.getValue({fieldId :'custbody_authnet_use'}) || context.newRecord.getValue({fieldId :'custbody_authnet_override'})))
                {
                    log.audit('Skipping cashrefund', 'Not authnet or overriden!');
                    //added explicitly to control the UI fields o nthe cash refund becasue it may NOT know it's from an AuthNet history
                    _.forEach(authNet.CCENTRY, function (fd) {
                        var fld = 'custbody_authnet_' + fd;
                        try {
                            form.getField({id: fld}).updateDisplayType({
                                displayType: ui.FieldDisplayType.HIDDEN
                            });
                        } catch (e){
                            log.error('MISSING A CCENTRY FIELD!', fld)
                        }
                    });
                }
                //else if (context.type === context.UserEventType.CREATE && context.newRecord.getValue({fieldId :'custbody_authnet_use'}) && !context.newRecord.getValue({fieldId :'custbody_authnet_override'}))
                else if (context.type === context.UserEventType.CREATE)
                {
                    var i_createdfrom = context.newRecord.getValue({fieldId: 'createdfrom'}) ? context.newRecord.getValue({fieldId: 'createdfrom'}) : context.newRecord.getValue({fieldId: 'salesorder'});
                    //ENSURE the response fields are hidden on a create since they would be empty
                    log.audit(_.toUpper(context.newRecord.type) + ' doing a CREATE here', 'from: ' + _.isUndefined(i_createdfrom) ? 'New Txn' : i_createdfrom);
                    //hide the override on a create - you would not do that normally
                    if (_.includes(['salesorder'], context.newRecord.type)) {
                        try {
                            form.getField({id: 'custbody_authnet_override'}).updateDisplayType({
                                displayType: ui.FieldDisplayType.HIDDEN
                            });
                        } catch (e) {
                            log.error('MISSING OVERRIDE CODE FIELD!', fld);
                        }
                    }
                    //should be disabled
                    var setFields = (context.newRecord.getValue({fieldId: 'custbody_authnet_refid'})) ? ui.FieldDisplayType.DISABLED : ui.FieldDisplayType.HIDDEN;
                    //get values for doing work
                    _.forEach(authNet.CODES, function (fd) {
                        var fld = 'custbody_authnet_' + fd;
                        try {
                            form.getField({id: fld}).updateDisplayType({
                                displayType: setFields
                            });
                        } catch (e){
                            log.error('MISSING A CODE FIELD!', fld)
                        }

                    });
                    //should be cleared
                    context.newRecord.setValue({fieldId :'custbody_authnet_datetime', value :''});
                    _.forEach(authNet.SETTLEMENT, function (fd) {
                        var fld = 'custbody_authnet_' + fd;
                        try {
                            context.newRecord.setValue({fieldId :fld, value :''});
                        } catch (e){
                            log.error('MISSING A SETTLEMENT FIELD!', fld)
                        }
                    });

                    //context.newRecord.setValue({fieldId: 'custbody_authnet_use', value: false});
                    switch (context.newRecord.type) {
                        //no invoice here becasue it's always cut out
                        case 'cashsale':
                            //prevent anything crazy from going on if people already have a pnref
                            try{
                                if (context.newRecord.getValue('pnrefnum') || context.newRecord.getValue('authcode')){
                                    form.getField({id: 'custbody_authnet_use'}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.DISABLED
                                    });
                                }
                            } catch(ex){
                                log.emergency('pnref AND a authnet - ohh boy')
                            }
                            //two options - 1 - cash nad cary - single auth net transaction OR from a SO
                            if (i_createdfrom ){
                                log.debug('cash sale', 'created from ' + i_createdfrom)
                                //todo - add support for a config option allowing MULTIPLE cash sales - each subsequent one a auth/capture off token or card
                                if (context.newRecord.getValue({fieldId: 'custbody_authnet_refid'})){
                                    form.getField({id: 'custbody_authnet_use'}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.DISABLED
                                    });
                                    //the date/time from the SO needs to be removed so the plugin will trigger the CS capture
                                    //context.newRecord.setValue({fieldId: 'custbody_authnet_datetime', value : ''});
                                    log.debug('unset the date!')
                                    try {
                                        form.getField({id: (o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod')}).updateDisplayType({
                                            displayType: ui.FieldDisplayType.DISABLED
                                        });
                                    } catch (e) {
                                        //todo - make aware of credit cards turned on
                                    }
                                    /*_.forEach(authNet.CODES, function (fd) {
                                        var fld = 'custbody_authnet_' + fd;
                                        try {
                                            form.getField({id: fld}).updateDisplayType({
                                                displayType: ui.FieldDisplayType.DISABLED
                                            });
                                        } catch (e){}
                                    });
                                    */
                                    _.forEach(authNet.CCENTRY, function (fd) {
                                        var fld = 'custbody_authnet_' + fd;
                                        try {
                                            form.getField({id: fld}).updateDisplayType({
                                                displayType: ui.FieldDisplayType.HIDDEN
                                            });
                                        } catch (e){
                                            log.error('MISSING A CCENTRY FIELD!', fld)
                                        }
                                    });
                                }
                            } else {

                            }
                            break;
                        case 'customerdeposit':
                            var s_status = context.newRecord.getValue({fieldId: 'status'}) ? context.newRecord.getValue({fieldId: 'status'}) : 'NEW';
                            log.debug('customerdeposit status : '+s_status, 'created from ' + i_createdfrom)
                            //2 cases - from a SO or individual deposit
                            if (i_createdfrom){
                                if (context.newRecord.getValue({fieldId: 'custbody_authnet_refid'})){
                                    form.getField({id: 'custbody_authnet_use'}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.DISABLED
                                    });
                                    try {
                                        form.getField({id: (o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod')}).updateDisplayType({
                                            displayType: ui.FieldDisplayType.DISABLED
                                        });
                                    } catch (e) {
                                    }

                                    /*_.forEach(authNet.CODES, function (fd) {
                                        var fld = 'custbody_authnet_' + fd;
                                        try {
                                            form.getField({id: fld}).updateDisplayType({
                                                displayType: ui.FieldDisplayType.DISABLED
                                            });
                                        } catch (e){}
                                    });
                                    */
                                    _.forEach(authNet.CCENTRY, function (fd) {
                                        var fld = 'custbody_authnet_' + fd;
                                        try {
                                            form.getField({id: fld}).updateDisplayType({
                                                displayType: ui.FieldDisplayType.HIDDEN
                                            });
                                        } catch (e){
                                            log.error('MISSING A CCENTRY FIELD!', fld)
                                        }
                                    });
                                }
                            }
                            break;
                        case 'customerpayment':
                            _.forEach(authNet.CCENTRY, function (fd) {
                                var fld = 'custbody_authnet_' + fd;
                                try {
                                    form.getField({id: fld}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.HIDDEN
                                    });
                                } catch (e){
                                    //log.error('Field Not on Form', form + ' missing ' + fld)
                                }
                            });
                            break;
                        case 'cashrefund':
                            _.forEach(authNet.CCENTRY, function (fd) {
                                var fld = 'custbody_authnet_' + fd;
                                try {
                                    form.getField({id: fld}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.HIDDEN
                                    });
                                } catch (e){
                                    log.error('MISSING A CCENTRY FIELD!', fld)
                                }
                            });
                            break;
                        case 'customerrefund':
                            _.forEach(authNet.CCENTRY, function (fd) {
                                var fld = 'custbody_authnet_' + fd;
                                try {
                                    form.getField({id: fld}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.HIDDEN
                                    });
                                } catch (e){
                                    log.error('MISSING A CCENTRY FIELD!', fld)
                                }
                            });
                            //hide the token selector here
                            try {
                                form.getField({id: 'custbody_authnet_cim_token'}).updateDisplayType({
                                    displayType: ui.FieldDisplayType.HIDDEN
                                });
                            } catch (e){
                                log.error('MISSING A CCENTRY FIELD!', fld)
                            }

                            break;

                        default:
                            break;
                    }
                }
                else if (context.type === context.UserEventType.CREATE && context.newRecord.type === 'customerpayment')
                {
                    form.getField({id: 'custbody_authnet_authcode'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    form.getField({id: 'custbody_authnet_refid'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                }
                //log.debug('authNetBeforeLoad DONE : '+runtime.executionContext, context.type);
            }
        }
        function authNetBeforeSubmit(context) {
            if(_.includes(['creditmemo'], context.newRecord.type))
            {
                return;
            }
            //var o_config = authNet.getActiveConfig(context.newRecord);
            var o_config2 = authNet.getConfigFromCache();
            if (_.isUndefined(o_config2) || _.isEmpty(o_config2))
            {
                return;
            }
            //now switch the object to the correct sub config!
            if (o_config2.mode === 'subsidiary'){
                o_config2 = authNet.getSubConfig(context.newRecord.getValue({fieldId : 'subsidiary'}), o_config2);
            }
            //check for EMPTY config on setup
            if (_.isUndefined(o_config2) || _.isEmpty(o_config2))
            {
                log.error('SuiteAuthConnect is not SET UP', 'Authorize.Net setup has not been complete!');
                return;
            }
            else if (o_config2.custrecord_an_enable.val)
            {
                log.debug('STARTING authNetBeforeSubmit : '+runtime.executionContext, context.type +' on '+context.newRecord.type);
                //runtime.getCurrentSession().set({name: "anetConfig", value: JSON.stringify(o_config)});
                //manage external import of sales orders with auth
                if (context.type === context.UserEventType.CREATE){
                    if (context.newRecord.getValue({fieldId: 'custbody_authnet_authcode'}) && context.newRecord.getValue({fieldId: 'custbody_authnet_settle_status'}).indexOf('PENDING') === 0)
                    {
                        log.audit('Some AUTHNET Data Pre populated', 'Will not clear all fields and will process accordingly');
                    }
                    else
                    {
                        //if this is a create - there's no way it could have an auth date stamp
                        context.newRecord.setValue({fieldId: 'custbody_authnet_datetime', value: ''});
                        //clear anything here too
                        _.forEach(authNet.SETTLEMENT, function (fd)
                        {
                            var fld = 'custbody_authnet_' + fd;
                            try {
                                context.newRecord.setValue({fieldId: fld, value: ''});
                            } catch (e) {
                                log.error('MISSING A SETTLEMENT FIELD!', fld)
                            }
                        });
                    }

                    //var o_config = JSON.parse(runtime.getCurrentSession().get({name: "anetConfig"}));
                    if (context.newRecord.type === 'salesorder') {
                        if (o_config2.custrecord_an_external_auth_allowed.val) {
                            //if (o_config.rec.getValue({fieldId: 'custrecord_an_external_auth_allowed'})){
                            if (context.newRecord.getValue({fieldId: o_config2.custrecord_an_external_fieldid.val}) && context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}))
                            {
                                var o_status = authNet.getStatusCheck(context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}));
                                //todo - test this
                                /*if (!o_status.isValid)
                                {
                                    throw error.create({
                                        name: 'Unable to Validate transid '+context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}),
                                        message: 'The following message was received from Authorize.Net when attempting to validate this transaction : '+JSON.stringify(o_status.messages.message),
                                        notifyOff: true
                                    });
                                }*/
                                context.newRecord.setValue({fieldId: 'custbody_authnet_use', value: true});
                                context.newRecord.setValue({
                                    fieldId: 'custbody_authnet_datetime',
                                    value: moment(o_status.fullResponse.submitTimeLocal).toDate()
                                });
                                if (_.isEmpty(context.newRecord.getValue({fieldId: 'custbody_authnet_authcode'}))) {
                                    context.newRecord.setValue({
                                        fieldId: 'custbody_authnet_authcode',
                                        value: o_status.fullResponse.authCode
                                    });
                                }
                                if (o_config2.custrecord_an_make_deposit.val) {
                                    context.newRecord.setValue({fieldId: (o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'), value: ''});
                                } else {
                                    context.newRecord.setValue({
                                        fieldId: (o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'),
                                        value: o_config2.custrecord_an_paymentmethod.val
                                    });
                                }
                                if (o_status.fullResponse.payment.tokenInformation)
                                {
                                    context.newRecord.setValue({
                                        fieldId: 'custbody_authnet_settle_status',
                                        value: 'EXTERNAL TOKEN PAYMENT'
                                    });
                                }
                            }
                        }
                        //added to ensure if you have checked authorize.net - the payment method is set 100% of the time
                        else if (context.newRecord.getValue({fieldId: 'custbody_authnet_use'}))
                        {
                            context.newRecord.setValue({
                                fieldId: (o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'),
                                value: o_config2.custrecord_an_paymentmethod.val
                            });
                        }
                    }
                    else if (context.newRecord.type === 'cashsale')
                    {
                        try{
                            if (context.newRecord.getValue('pnrefnum') || context.newRecord.getValue('authcode')){
                                context.newRecord.setValue({fieldId :'custbody_authnet_use', value :false});
                            }
                        } catch(ex){
                            log.emergency('pnref AND a authnet - ohh boy')
                        }
                        if (!context.newRecord.getValue({fieldId :'custbody_authnet_override'}) && context.newRecord.getValue({fieldId :'createdfrom'}) && context.newRecord.getValue({fieldId :'custbody_authnet_refid'})){
                            log.audit('Pre Authed Cash Sale ', 'Preped to capture funds on submit');
                            context.newRecord.setValue({fieldId :'custbody_authnet_use', value : true});
                        }
                        //validate this cash sale before you submit it
                        if (context.newRecord.getValue({fieldId : 'custbody_authnet_refid'}) && context.newRecord.getValue({fieldId : 'createdfrom'})) {
                            var o_authCheck = authNet.getStatusCheck(context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}));
                            if (o_authCheck.transactionStatus !== "authorizedPendingCapture"
                                &&
                                o_authCheck.transactionStatus !== "settledSuccessfully"
                                &&
                                o_authCheck.transactionStatus !== "capturedPendingSettlement") {
                                throw error.create({
                                    name: 'Unable to Capture Authorize.Net',
                                    message: 'The creating sales order is in a ' + o_authCheck.transactionStatus + ' state with Authorize.Net and can not be billed / captured.',
                                    notifyOff: true
                                });
                            }
                        }

                    }


                }
                else if (context.type === context.UserEventType.DELETE
                    &&
                    (context.newRecord.getValue({fieldId : 'custbody_authnet_refid'}) || context.oldRecord.getValue({fieldId : 'custbody_authnet_refid'}))
                    &&
                    (context.newRecord.getValue({fieldId : 'custbody_authnet_datetime'}) || context.oldRecord.getValue({fieldId : 'custbody_authnet_datetime'}))
                ){
                    if (context.newRecord.getValue('custbody_authnet_settle_status') === 'voided')
                    {
                        log.audit('This transaction was deleted', 'The settlement reported this as voided so - removal is allowed');
                    }
                    else if (!context.newRecord.getValue({fieldId : 'custbody_authnet_override'}))
                    {
                        throw '<span style=color:black;font-weight:bold;font-size:24px><p>TRANSACTION IS LINKED TO AUTHORIZE.NET - CAN NOT DELETE</p></span>'+
                            '<span style=color:red;font-weight:bold;font-size:24px>This transaction has been processed through a payment gateway <p> REFID is : ' + context.oldRecord.getValue('custbody_authnet_refid') + '</p>' +
                                '<p>You must use the appropriate transaction in NetSuite to undo / change this transaction (or save the record with override authorize.net checked and then edit / delete the record)</p></span>';
                    }
                }
                else if (context.type === context.UserEventType.CREATE && context.newRecord.getValue('custbody_authnet_use') && context.newRecord.getValue({fieldId: 'orderstatus'}) === 'A' && o_config2.custrecord_an_generate_token_pend_approv.val)
                {

                }
                else if (context.type === context.UserEventType.APPROVE && +context.newRecord.getValue('custbody_authnet_cim_token') !== 0)
                {

                }
                else if (context.newRecord.getValue('custbody_authnet_override'))
                {
                    context.newRecord.setValue('custbody_authnet_datetime','');
                }
                else if (context.newRecord.type === 'invoice' && o_config2.custrecord_an_enable_click2pay_inv.val)
                {
                    if (_.isEmpty(context.oldRecord.getValue({fieldId : 'custbody_authnet_c2p_url'})))
                    {
                        log.audit('Generating Payment Link Now', 'Click 2 Pay Link being added to Invoice');
                        try {
                            var suiteletURL = authNetC2P.paymentlink.serviceUrl();
                            var o_encryptedId = authNetC2P.crypto.encrypt(context.newRecord.id, 'custsecret_authnet_payment_link');
                            suiteletURL += '&xkcd=' + authNetC2P.crypto.encode64(JSON.stringify(o_encryptedId));
                            context.newRecord.setValue({fieldId: 'custbody_authnet_c2p_url', value: suiteletURL});
                        }
                        catch(ex)
                        {
                            log.emergency(ex.name, ex.message);
                        }
                    }
                }
                log.debug('ENDING authNetBeforeSubmit : '+runtime.executionContext, context.type +' on '+context.newRecord.type + ' COMPLETED');
            }
            else
            {
                log.audit('SKIPPING authNetBeforeSubmit : '+runtime.executionContext, context.type +' on '+context.newRecord.type + ' authNet is not globally enabled!');
            }
            if (context.newRecord.getValue({fieldId: 'custbody_authnet_override'}))
            {
                context.newRecord.setValue({fieldId: 'custbody_authnet_use', value : false});
            }

        }
        function authNetAfterSubmit(context) {
            //log.debug('here?')
            if(_.includes(['creditmemo'], context.newRecord.type))
            {
                return;
            }
            var o_config2 = authNet.getConfigFromCache();
            if (_.isUndefined(o_config2) || _.isEmpty(o_config2))
            {
                return;
            }
            log.debug('STARTING authNetAFTERSubmit via: '+runtime.executionContext, context.type +' on '+context.newRecord.type);

            //todo - get the most recent log record and update the transaction???
            //var o_config = authNet.getActiveConfig(context.newRecord);
            if (o_config2.mode === 'subsidiary'){
                o_config2 = authNet.getSubConfig(context.newRecord.getValue({fieldId : 'subsidiary'}), o_config2);
            }

            authNet.verboseLogging('authNetAfterSubmit o_config2',o_config2);

            //Is any of this turned on?
            //if (!o_config.rec.getValue({fieldId: 'custrecord_an_enable'})) {
            if (_.isUndefined(o_config2) || _.isEmpty(o_config2))
            {
                log.error('SuiteAuthConnect is not SET UP', 'Authorize.Net setup has not been complete!');
                return;
            }
            else if (!o_config2.custrecord_an_enable.val) {
                log.error('SuiteAuthConnect is not Enabled', 'Authorize.Net will not be contacted as the master SAC configuration is not enabled!');
                return;
            }

            //log.debug(licenceValidation, o_config)
            //log.debug('authNetAfterSubmit : ' + runtime.executionContext, context.type +' on '+context.newRecord.type);
            //if (licenceValidation.valid && context.type !== context.UserEventType.DELETE && !context.newRecord.getValue('custbody_authnet_override')) {
            if (context.type !== context.UserEventType.DELETE && !context.newRecord.getValue('custbody_authnet_override')) {
                //log.debug('newRecord.orderstatus', context.newRecord.getValue('orderstatus')); //B when just approved
                //log.debug('oldRecord.orderstatus', context.oldRecord.getValue('orderstatus')); //A when pending approval
                var s_newStatus = context.newRecord.getValue('orderstatus');
                //var s_oldStatus = (context.type === context.UserEventType.CREATE) ? 'A' : context.oldRecord.getValue('orderstatus');
                //log.debug('status old and new', s_oldStatus + ' : ' + s_newStatus);
                switch (context.newRecord.type) {
                    case 'salesorder':
                        var thisRec;
                        if (context.type === context.UserEventType.CANCEL)
                        {
                            var txn = record.load({
                                type: record.Type.SALES_ORDER,
                                id: context.newRecord.id,
                                isDynamic: true
                            });
                            var s_authRefId = txn.getValue('custbody_authnet_refid');
                            if (!_.isEmpty(s_authRefId)) {
                                var m_authDate = moment(txn.getValue('custbody_authnet_datetime'), 'MM/DD/YYYY hh:mm:ss a');
                                var m_midnight = moment().endOf('day').subtract(59, 'seconds');
                                //if we can void - we void
                                if (m_authDate < m_midnight) {
                                    thisRec = authNet.doVoid(txn);
                                    log.audit('CANCELED SO', thisRec);
                                }
                            }
                        }
                        else
                        {
                            //EXTERNAL AUTH LOGIC HERE
                            //log.debug(o_config2.custrecord_an_external_auth_allowed.val, context.newRecord.getValue(o_config2.custrecord_an_external_fieldid.val))
                            if (context.type === context.UserEventType.CREATE && o_config2.custrecord_an_external_auth_allowed.val && !_.isEmpty(context.newRecord.getValue(o_config2.custrecord_an_external_fieldid.val)))
                            { //runtime.executionContext !== 'USERINTERFACE'
                                if (o_config2.custrecord_an_external_auth_allowed.val){
                                    if (context.newRecord.getValue({fieldId : o_config2.custrecord_an_external_fieldid.val}) && context.newRecord.getValue({fieldId : 'custbody_authnet_refid'})) {
                                        //log.debug('the field is ' + o_config2.custrecord_an_external_fieldid.val, context.newRecord.getValue({fieldId : o_config2.custrecord_an_external_fieldid.val}));
                                        var o_status = authNet.getStatusCheck(context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}));
                                        authNet.verboseLogging('o_status from EXTERNAL AUTH', o_status);
                                        if(o_status.transactionStatus === 'capturedPendingSettlement' && !o_config2.custrecord_an_make_deposit.val)
                                        {
                                            log.emergency('THIS SHOULD NOT HAPPEN', 'Sales Order BEING CREATED WITH A CAPTURED TRANSACTION AND NO DEPOSIT PATHWAY CONFIGURED - POOR ACCOUNTING PRACTICE VIOLATION!');
                                            authNet.handleResponse(o_status, context, true);
                                            throw error.create({name:'Imported transaction '+ context.newRecord.getValue({fieldId: o_config2.custrecord_an_external_fieldid.val}) +' blocked', message: 'This transaction is attempting to create a Sales Order but using a '+o_status.transactionStatus+ ' transaction. You need to configure the creation of deposits in your Authorize.net Connector to follow proper accoutning guidelines for a posting transaction.'});
                                        }
                                        var b_continue = authNet.makeIntegrationHistoryRec(context.newRecord, o_config2, o_status);
                                        if (b_continue) {
                                            if (o_config2.custrecord_an_cim_auto_generate.val) {
                                                //if the o_status object has payment.tokenInformation, this is a no go
                                                try {
                                                    if (!o_status.fullResponse.payment.tokenInformation)
                                                    {
                                                        authNet.getCIM(context.newRecord, o_config2);
                                                    }
                                                    else
                                                    {
                                                        log.error('Transaction used EXTERNAL TOKEN', 'This transaction was paid via an externally tokenized card that can not be re-used in Authorize.Net therefore no profile was generated.');
                                                    }
                                                } catch (ex) {
                                                    log.error('Unable to generate CIM/Token off imported transaction', context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}) + ' reference ID failed to generate a CIM profile - check Authorize.Net for the validity of that transaction.')
                                                }
                                            }
                                            if (o_config2.custrecord_an_make_deposit.val) {
                                                try {

                                                    //log.debug('o_status', o_status)
                                                    //differne between status and type in the response - type == "transactionType": "authOnlyTransaction",
                                                    //         "transactionStatus": "authorizedPendingCapture",
                                                    //settledSuccessfully is required if a deposit sits for a while and settles before import
                                                    if (o_status.transactionStatus === 'capturedPendingSettlement' || o_status.transactionStatus === 'settledSuccessfully') {
                                                        var rec_deposit = record.create({
                                                            type: record.Type.CUSTOMER_DEPOSIT,
                                                            isDynamic: true,
                                                            defaultValues : {
                                                                entity: context.newRecord.getValue({fieldId:'entity'}),
                                                                salesorder: context.newRecord.id
                                                            }
                                                        });
                                                        //todo - make a deposit config in the config
                                                        rec_deposit.setValue({fieldId: 'undepfunds', value: 'T'});
                                                        rec_deposit.setValue({fieldId:'payment', value: o_status.fullResponse.settleAmount});
                                                        //rec_deposit.setValue({fieldId:'payment', value: context.newRecord.getValue({fieldId:'total'})});
                                                        rec_deposit.setValue({fieldId:(o_config2.hasPaymentInstruments ? 'paymentoption' : 'paymentmethod'), value: o_config2.custrecord_an_paymentmethod.val});
                                                        rec_deposit.setValue({fieldId:'custbody_authnet_use', value: true});
                                                        rec_deposit.setValue({fieldId:'custbody_authnet_refid', value: context.newRecord.getValue({fieldId: 'custbody_authnet_refid'})});
                                                        rec_deposit.setValue({fieldId:'custbody_authnet_authcode', value: context.newRecord.getValue({fieldId: 'custbody_authnet_authcode'})});
                                                        rec_deposit.setValue({fieldId:'custbody_authnet_datetime', value: moment(context.newRecord.getValue({fieldId: 'custbody_authnet_datetime'})).toDate()});
                                                        rec_deposit.setValue({fieldId:'memo', value: 'WebStore Auth+Capture Deposit'});
                                                        var i_depositId = rec_deposit.save({ignoreMandatoryFields:true});
                                                        authNet.getStatus(record.load({
                                                            type: record.Type.CUSTOMER_DEPOSIT,
                                                            id: i_depositId,
                                                            isDynamic: true,
                                                        }));
                                                    }
                                                    else if (o_status.transactionStatus === 'authorizedPendingCapture')
                                                    {
                                                        throw error.create({
                                                            name : 'NOT CAPTURED IN WEBSTORE - DEPOSIT NOT MADE - CONFIGURATION ISSUE!',
                                                            message : o_status.transactionStatus + ' is not a capture for the webstore order '+context.newRecord.getValue({fieldId: o_config2.custrecord_an_external_fieldid.val})
                                                        });
                                                    }
                                                    else
                                                    {
                                                        throw error.create({
                                                            name : 'Unknown / UnMapped Response',
                                                            message : o_status.transactionStatus + ' is not mapped for the deposit generation logic!'
                                                        });
                                                    }
                                                } catch (ex) {
                                                    log.error('DEPOSIT failed for imported transaction '+ context.newRecord.getValue({fieldId: o_config2.custrecord_an_external_fieldid.val}), ex.name + " :: " + ex.message);
                                                    throw 'DEPOSIT CREATION failed for imported transaction '+ context.newRecord.getValue({fieldId: o_config2.custrecord_an_external_fieldid.val}) +' '+ ex.name + " :: " + ex.message;

                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else
                            {
                                //INTERNAL AUTH HERE
                                //added to support "Perform Authorization On Approval of Sales Order Not Create/Save"
                                //holding the actual auth attempt until transaction approval
                                //is this pending approval orderstatus === 'A', and if it is and the
                                if (s_newStatus === 'A' && o_config2.custrecord_an_auth_so_on_approval.val && context.type !== context.UserEventType.APPROVE)
                                {
                                    log.audit('This Sales Order was not authorized yet', 'The setting "Perform Authorization On Approval of Sales Order Not Create/Save" is enabled - so this order will be processed upon approval');
                                    return;
                                }
                                var b_isTokenized = (_.toInteger(context.newRecord.getValue({fieldId :'custbody_authnet_cim_token'})) !== 0);
                                var pluginResult = plugin.loadImplementation({type: 'customscript_sac_txn_mgr_pi'}).testSO(context.newRecord);
                                if (pluginResult.process) {
                                    //if there was a cc number, its auth.net and it's not already approved, let's do it!
                                    thisRec = authNet.getAuth(context.newRecord);
                                    if (thisRec.getValue({fieldId:'custbody_authnet_settle_status'}) !== 'ERR' && !thisRec.getValue({fieldId:'custbody_authnet_error_status'}))
                                    {
                                        if(!thisRec.getValue({fieldId :'custbody_authnet_refid'})){
                                            thisRec.setValue({fieldId :'custbody_authnet_use', value :false});
                                            log.audit('Cleared the "Use Authorize.net" Checkbox', 'This transaction does not have a refid, so it\'s not authnet');
                                        } else {
                                            //so things coded but failed anyhow - like AVS issues
                                            if (thisRec.getValue({fieldId :'custbody_authnet_authcode'}) && !thisRec.getValue({fieldId :'custbody_authnet_error_status'})){
                                                //thisRec.setValue({fieldId :'ccapproved', value :true});
                                                if (!b_isTokenized && o_config2.custrecord_an_cim_auto_generate.val) {
                                                    //todo - will never happen now in this version
                                                    authNet.getCIM(thisRec, o_config2);
                                                }
                                            }
                                        }
                                    }
                                    else
                                    {
                                        log.error('Error with Authorize.Net', 'An exception was thrown resulting from a likely communication error');
                                    }
                                    thisRec.save({ignoreMandatoryFields : true});
                                } else {
                                    thisRec = context.newRecord;
                                }
                            }
                        }
                        break;
                    case 'cashsale':
                        //log.debug('what do we do with this cash sale', context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}) +' :: ' +context.newRecord.getValue({fieldId: 'createdfrom'}))
                        //if we have a cash sale with a refid - we are good to go
                        var thisCS = record.load({
                            type : record.Type.CASH_SALE,
                            id: context.newRecord.id,
                            isDynamic: true });
                        var o_response = {csissue : true};
                        var pluginResult;
                        if (thisCS.getValue({fieldId: 'createdfrom'})){
                            pluginResult = plugin.loadImplementation({type: 'customscript_sac_txn_mgr_pi'}).testCSfromSO(thisCS);
                            if(pluginResult.process) {
                                //so capture from the auth - use the full record
                                o_response = authNet[pluginResult.type](thisCS);
                                //log.debug('o_response', o_response)
                                authNet.handleResponse(o_response, context, true);
                            }
                        } else {
                            pluginResult = plugin.loadImplementation({type: 'customscript_sac_txn_mgr_pi'}).testCSStandalone(thisCS);
                            if(pluginResult.process) {
                                //so capture from the auth - use the full record
                                log.audit('Capturing Funds On CS', thisCS.getValue({fieldId:'tranid'}));
                                o_response = authNet.getAuthCapture(context.newRecord);
                                authNet.homeSysLog('CASH SALE SAVE o_response', o_response);
                                authNet.handleResponse(o_response, context, true);
                            }
                        }

                        break;
                    case 'cashrefund':
                        var o_response = {csissue : true};
                        //log.debug('cashrefund custbody_authnet_done', context.newRecord.getValue('custbody_authnet_done'));
                        var pluginResult = plugin.loadImplementation({type: 'customscript_sac_txn_mgr_pi'}).testCashR(context);
                        if (pluginResult.process) {
                            //Get the refund made and do the REFUND
                            var refund = record.load({
                                type: record.Type.CASH_REFUND,
                                id: context.newRecord.id,
                                isDynamic: true
                            });
                            //todo - if theres a tranid - use that one
                            var o_cratedFrom = search.lookupFields({
                                type: search.Type.TRANSACTION,
                                id: refund.getValue({fieldId : 'createdfrom'}),
                                columns: ['type', 'custbody_authnet_datetime', 'total', 'createdfrom', 'custbody_authnet_refid']
                            });
                            //todo if this is from a RMA - what was that created from... if invoice - find payment on invoice
                            var f_refundTotal = +refund.getValue({fieldId : 'total'});
                            authNet.homeSysLog('o_createdFrom', o_cratedFrom);
                            var m_authDate = moment(o_cratedFrom.custbody_authnet_datetime, 'MM/DD/YYYY hh:mm:ss a');
                            var m_midnight = moment().endOf('day').subtract(59, 'seconds');
                            //if this is less than the total - we can only issue a refund
                            if (f_refundTotal < +o_cratedFrom.total){
                                //moment(date).add(-24, 'hours')
                                o_response = authNet.getRefund(refund);
                                authNet.homeSysLog('CASH REFUND o_response', o_response);
                                authNet.handleResponse(o_response, context, true);
                            } else {
                                if (m_authDate.isSame(m_midnight, 'day')){
                                    authNet.doVoid(refund);
                                    refund.setValue({fieldId : 'custbody_authnet_datetime', value : moment().toDate()});
                                    refund.save({ignoreMandatoryFields : true});
                                } else {
                                    o_response = authNet.getRefund(refund);
                                    authNet.homeSysLog('CASH REFUND o_response', o_response);
                                    authNet.handleResponse(o_response, context, true);
                                }
                            }
                        }
                        break;
                    case 'customerdeposit':
                        if (context.type === context.UserEventType.EDIT) {
                            var txn = record.load({
                                type: context.newRecord.type,
                                id: context.newRecord.id,
                                isDynamic: true
                            });
                            log.debug('customerdeposit - status old and new', context.oldRecord.getValue('status') + '/' +txn.getValue('status'));
                            if (txn.getValue({fieldId : 'custbody_authnet_refid'}) &&
                                (txn.getValue({fieldId : 'memo'}) === 'VOID' &&  context.oldRecord.getValue({fieldId : 'memo'}) !== 'VOID') &&
                                (txn.getValue({fieldId : 'status'}) === 'Fully Applied' &&  context.oldRecord.getValue({fieldId : 'status'}) === 'Not Deposited')
                            ) {
                                var m_authDate = moment(txn.getValue('custbody_authnet_datetime'), 'MM/DD/YYYY hh:mm:ss a');
                                var m_midnight = moment().endOf('day').subtract(59, 'seconds');
                                var o_response;
                                //if we can void - we void
                                if (m_authDate < m_midnight) {
                                    o_response = authNet.doVoid(txn);
                                    authNet.homeSysLog('DEPOSIT VOID o_response', o_response);
                                    authNet.handleResponse(o_response, context, false);
                                }
                            }
                            else if (
                                txn.getValue({fieldId : 'custbody_authnet_use'})
                                &&
                                txn.getValue({fieldId : 'custbody_authnet_cim_token'})
                                &&
                                !txn.getValue({fieldId : 'custbody_authnet_refid'})
                                &&
                                !txn.getValue({fieldId : 'custbody_authnet_datetime'})
                                )
                            {
                                //this is a missed deposit that someone now wants to charge through, so run it
                                var pluginResult = plugin.loadImplementation({type: 'customscript_sac_txn_mgr_pi'}).testCD(context.newRecord);
                                if (pluginResult.process) {
                                    //if there was a cc number, its auth.net and it's not already approved, let's do it!
                                    var o_response = authNet.getAuthCapture(context.newRecord);
                                    //log.debug('o_response', o_response)
                                    authNet.homeSysLog('DEPOSIT SAVE o_response', o_response);
                                    authNet.handleResponse(o_response, context, true);
                                }
                            }
                        } else {
                            var pluginResult = plugin.loadImplementation({type: 'customscript_sac_txn_mgr_pi'}).testCD(context.newRecord);
                            if (pluginResult.process) {
                                //if there was a cc number, its auth.net and it's not already approved, let's do it!
                                var o_response = authNet.getAuthCapture(context.newRecord);
                                //log.debug('o_response', o_response)
                                authNet.homeSysLog('DEPOSIT SAVE o_response', o_response);
                                authNet.handleResponse(o_response, context, true);
                            }
                        }
                        break;
                    case 'customerpayment':
                        //log.debug('customerpayment - status old and new');
                        var pluginResult = plugin.loadImplementation({type: 'customscript_sac_txn_mgr_pi'}).testCP(context.newRecord);
                        if (pluginResult.process)
                        {
                            //if there was a cc number, its auth.net and it's not already approved, let's do it!
                            var o_response = authNet.getAuthCapture(context.newRecord);
                            authNet.homeSysLog('customerpayment - getAuthCapture - o_response', o_response);
                            authNet.handleResponse(o_response, context, true);
                        }
                        if (context.type === context.UserEventType.EDIT) {
                            if ((context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}) !== context.oldRecord.getValue({fieldId: 'custbody_authnet_refid'}))
                                &&
                                runtime.executionContext === runtime.ContextType.USER_INTERFACE) {
                                //added logic to auto settle this realtime if possible for externally transacted transactions
                                try {
                                    if (context.newRecord.getValue({fieldId: 'custbody_authnet_refid'})) {
                                        txn = record.load({
                                            type: context.newRecord.type,
                                            id: context.newRecord.id
                                        });
                                        authNet.doSettlement(txn);
                                    }
                                } catch (e) {
                                    log.error(e.name, e.message);
                                    log.error(e.name, e.stack);
                                }
                            }
                        }
                        break;
                    case 'customerrefund':
                        log.audit(context.newRecord.type + ' - evaluating');
                        var pluginResult = plugin.loadImplementation({type: 'customscript_sac_txn_mgr_pi'}).testCustR(context,o_config2);
                        //if (true) {
                        if (pluginResult.process) {
                            //look for all lines that have a T and then process refunds in that amount per transaction
                            var a_txnObj = [];
                            var txn = record.load({
                                type: context.newRecord.type,
                                id: context.newRecord.id//,
                                //isDynamic: true
                            });
                            var f_totalRefund = 0;
                            for(var i = txn.getLineCount('apply')-1; i>= 0; i--){
                                var b_toRefundId = txn.getSublistValue({sublistId: 'apply' , fieldId: 'apply', line:i});
                                if (b_toRefundId){
                                    a_txnObj.push({
                                        from : context.newRecord.id,
                                        fromType : context.newRecord.type,
                                        id : +txn.getSublistValue({sublistId: 'apply' , fieldId: 'doc', line:i}),
                                        applyType : txn.getSublistValue({sublistId: 'apply' , fieldId: 'type', line:i}),
                                        amount : txn.getSublistValue({sublistId: 'apply' , fieldId: 'amount', line:i})
                                    });
                                    f_totalRefund += txn.getSublistValue({sublistId: 'apply' , fieldId: 'amount', line:i});
                                }
                            }
                            for(var i = txn.getLineCount('deposit')-1; i>= 0; i--){
                                var b_toRefundId = txn.getSublistValue({sublistId: 'deposit' , fieldId: 'apply', line:i});
                                if (b_toRefundId){
                                    a_txnObj.push({
                                        from : context.newRecord.id,
                                        fromType : context.newRecord.type,
                                        id : +txn.getSublistValue({sublistId: 'deposit' , fieldId: 'doc', line:i}),
                                        applyType : txn.getSublistValue({sublistId: 'deposit' , fieldId: 'type', line:i}),
                                        amount : txn.getSublistValue({sublistId: 'deposit' , fieldId: 'amount', line:i})
                                    });
                                    f_totalRefund += txn.getSublistValue({sublistId: 'deposit' , fieldId: 'amount', line:i});
                                }
                            }
                            log.audit('Generating Refund Call for '+txn.getValue({fieldId:'tranid'}), '$'+f_totalRefund + ' on '+ a_txnObj.length + ' transactions!');
                            //log.debug('a_txnObj', a_txnObj)
                            var o_response = authNet.getBulkRefunds(txn, a_txnObj);
                            authNet.homeSysLog('customerrefund - getBulkRefunds - o_response', o_response);
                            authNet.homeSysLog('o_response', o_response)
                            //this is going to have to loop over the individual refund lines and refund EACH per transaction
                            authNet.handleResponse(o_response, context, false);
                        }
                        break;
                    case 'invoice':
                        if (o_config2.custrecord_an_enable_click2pay_inv.val)
                        {
                            if (_.isEmpty(context.newRecord.getValue({fieldId : 'custbody_authnet_c2p_url'})))
                            {
                                log.audit('Generating Payment Link Now', 'Click 2 Pay Link being added to Invoice');
                                try {
                                    var suiteletURL = authNetC2P.paymentlink.serviceUrl();
                                    var o_encryptedId = authNetC2P.crypto.encrypt(context.newRecord.id, 'custsecret_authnet_payment_link');
                                    suiteletURL += '&xkcd=' + authNetC2P.crypto.encode64(JSON.stringify(o_encryptedId));
                                    record.submitFields({
                                        type : 'invoice',
                                        id : context.newRecord.id,
                                        values : {'custbody_authnet_c2p_url' : suiteletURL},
                                        options : {ignoreMandatoryFields:true}
                                    });
                                }
                                catch(ex)
                                {
                                    log.emergency(ex.name, ex.message);
                                }
                            }
                        }
                        break;
                    default:
                        log.error(context.newRecord.type, 'NOT CONFIGURED FOR ANY AUTHNET ACTIONS!');
                        break;
                }
            }
            log.debug('ENDING authNetAfterSubmit : ' + runtime.executionContext, context.type +' on '+context.newRecord.type + ' FULLY COMPLETED!');
        }
        return {
            beforeLoad: authNetBeforeLoad,
            beforeSubmit: authNetBeforeSubmit,
            afterSubmit: authNetAfterSubmit
        };
    });