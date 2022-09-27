/**
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
 *
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 *
 * @NAmdConfig ../config.json
 */


define(['N/record', 'N/plugin', 'N/runtime', 'N/error', 'N/search', 'N/log', 'N/ui/serverWidget', 'N/ui/message', 'N/redirect', 'lodash', './AuthNet_lib', 'moment'],
    function (record, plugin, runtime, error, search, log, ui, message, redirect, _, authNet, moment) {
        function authNetBeforeLoad(context) {
            log.audit('authNetBeforeLoad via : '+runtime.executionContext, context.type +' on '+context.newRecord.type);
            if (runtime.executionContext === 'USERINTERFACE' ) {
                var form = context.form;
                var o_config2 = authNet.getConfigFromCache();
                if (_.isUndefined(o_config2) || _.isEmpty(o_config2))
                {
                    log.error('SuiteAuthConnect is not SET UP', 'Authorize.Net setup has not been complete!');
                    form.addPageInitMessage({
                        type: message.Type.INFORMATION,
                        title: 'AUTHORIZE.NET setup is INCOMPLETE',
                        message: 'While this transaction may have nothing to do with Authorize.Net, the setup is incomplete and may cause unintended issues. An Administrator needs to complete the setup by navigating to Cloud 1001 > SuiteAuthConnect > SuiteAuthConnect Configuration and complete the setup.',
                    });
                    _.forEach(['custbody_authnet_ccnumber', 'custbody_authnet_ccexp', 'custbody_authnet_ccv'], function(fldname){
                        try {
                            form.getField({id: fldname}).updateDisplayType({
                                displayType: ui.FieldDisplayType.HIDDEN
                            });
                        } catch (e) {
                            log.error('Field Not on Form anyhow!', form + ' missing and authNet Field - '+fldname);
                        }
                    });
                    return;
                }
                var fld_config = form.addField({
                    id: 'custpage_an_config',
                    type: ui.FieldType.TEXTAREA,
                    label: 'ANetCfg'
                }).updateDisplayType({
                    displayType: ui.FieldDisplayType.HIDDEN
                });
                //pull this from cache if its not there
                var o_publicConfig = {};
                _.forEach(o_config2, function(val, kie){
                    //log.debug(kie, val)
                    if(!_.includes(authNet.SERVICE_CREDENTIAL_FIELDS, kie) && kie !== 'auth'){
                        o_publicConfig[kie] = val;
                    }
                });
                fld_config.defaultValue = JSON.stringify(o_publicConfig);
                //authNet.homeSysLog('the holy config object!', o_publicConfig);
                //var b_hasNativeCC = authNet.hasNativeCC();
                //Is any of this turned on?
                if (!o_config2.custrecord_an_enable.val) {
                    form.getField({id: 'custbody_authnet_use'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    form.getField({id: 'custbody_authnet_override'}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                    _.forEach(authNet.CCENTRY, function (fd) {
                        var fld = 'custbody_authnet_' + fd;
                        try {
                            form.getField({id: fld}).updateDisplayType({
                                displayType: ui.FieldDisplayType.HIDDEN
                            });
                        } catch (e){
                            log.error('Field Not on Form', form + ' missing ' + fld)
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
                        log.error('Field Not on Form', form + ' missing ' + fld)
                    }
                });

                //if tokens are not allowed - hide the token field!
                if (!o_config2.custrecord_an_cim_allow_tokens.val){
                    try {
                        form.getField({id: 'custbody_authnet_cim_token'}).updateDisplayType({
                            displayType: ui.FieldDisplayType.HIDDEN
                        });
                    } catch (ex) {
                        //nothing here - this field is not on all transactions
                    }
                }

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
                //if this is a magento order - hide all our fields becasue they are irrelevant
                //todo - put a check in here for actual auth.net processor
                //log.debug('AuthNetRequest', authNet.AuthNetRequest)
                //log.debug('underscore', _.isNaN(1))

                var b_doScripty = true;
                //never run on these custbody_celigo_magento_id and/or or custbody_celigo_magento
                if (!_.includes([context.UserEventType.CREATE, context.UserEventType.DELETE], context.type) )
                {
                    //some general variables here
                    var o_history = authNet.parseHistory(context.newRecord.id, context.newRecord.type),
                        b_responseFailure = (context.newRecord.getValue({fieldId: 'custbody_authnet_error_status'}) || !o_history.isValid),
                        b_hasToken = (+context.newRecord.getValue('custbody_authnet_cim_token') !== 0 && !_.isNaN(+context.newRecord.getValue('custbody_authnet_cim_token'))),
                        s_paymentVehicle = b_hasToken ? 'Token' : 'Credit Card',
                        b_isAuthNet = context.newRecord.getValue({fieldId :'custbody_authnet_use'})
                            || context.newRecord.getValue({fieldId: 'custbody_authnet_error_status'})
                            || _.includes([o_config2.custrecord_an_paymentmethod.val, o_config2.custrecord_an_paymentmethod_echeck.val], context.newRecord.getValue({fieldId: 'paymentmethod'}));
                    authNet.homeSysLog('history parsed', o_history);
                    authNet.homeSysLog('b_isAuthNet', b_isAuthNet);
                    //authNet.homeSysLog('thisRecord.getValue(\'orderstatus\')', context.newRecord.getValue('orderstatus'));
                    authNet.homeSysLog('b_responseFailure', b_responseFailure);
                    //authNet.homeSysLog('custbody_authnet_done', context.newRecord.getValue({fieldId:'custbody_authnet_done'}));

                    _.forEach(authNet.CCFIELDS, function (fd) {
                        var fld = 'custbody_authnet_' + fd;
                        try {
                            form.getField({id: fld}).updateDisplayType({
                                displayType: ui.FieldDisplayType.HIDDEN
                            });
                        } catch (e){
                            log.error('Field Not on Form', form + ' missing ' + fld)
                        }
                    });

                    //if this is a view - make the cc fields hidden for cleanness
                    if (context.type === context.UserEventType.VIEW){
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
                            } catch (e){
                                log.error('Field Not on Form', form + ' missing ' + fld)
                            }
                        });
                        /*if (o_config2.custrecord_an_external_auth_allowed.val){
                            //if the field custbody_authnet_use is hidden - and imports are allowed - and it's a SO - pop alert banner!
                            try {
                                //form.getField({id: 'custbody_authnet_use'});
                                //form.getValue({fieldId: 'custbody_authnet_use'});
                                //log.debug('custbody_authnet_use', form.getField({id: 'custbody_authnet_use'}).isVisible)
                            } catch (e){
                                log.error('Use AuthNet Not On Form', form + ' missing critical field for errors');
                                context.form.addPageInitMessage({
                                    type: message.Type.ERROR,
                                    title: 'This form does not have the "Use Authorize.Net" Field Accessible',
                                    message: 'Because your account is configured to import external authorization events, this field must remain on the form.  You may configure the field to be disabled, but lack of it\'s presence here will cause potential other issues with imported transactions and Authorize.Net.',
                                    //duration: 5000
                                });
                            }
                        }*/
                    }

                    if (context.type === context.UserEventType.COPY){
                        authNet.homeSysLog('CLEANING Auth values', 'This is a copy!');
                        var objRecord = context.newRecord;
                        _.forEach(authNet.ALLAUTH, function (fd) {
                            var fld = 'custbody_authnet_' + fd;
                            try {
                                objRecord.setValue({fieldId: fld, value: ''});
                            } catch (e){
                                log.error('Field Not on Form', form + ' missing ' + fld)
                            }
                        });
                        _.forEach(authNet.CODES, function (fd) {
                            var fld = 'custbody_authnet_' + fd;
                            try {
                                form.getField({id: fld}).updateDisplayType({
                                    displayType: ui.FieldDisplayType.HIDDEN
                                });
                            } catch (e){
                                log.error('Field Not on Form', form + ' missing ' + fld)
                            }
                        });
                        _.forEach(['custbody_authnet_use', 'paymentmethod', 'custbody_authnet_override'], function (fld) {

                            try {
                                objRecord.setValue({fieldId: fld, value: ''});
                            } catch (e){
                                log.error('Field Not on Form', form + ' missing ' + fld)
                            }
                        });
                    }

                    switch (context.newRecord.type) {
                        case 'salesorder':
                            //if this is a copy - we need to delete ALL the values in the field for credit card
                            if (context.type === context.UserEventType.COPY) {

                                break;
                            }
                            if (context.type === context.UserEventType.CANCEL) {
                                return;
                            }
                            var thisRecord = record.load({
                                type: context.newRecord.type,
                                id: context.newRecord.id,
                                isDynamic: true
                            });
                            //some people have cc native and some do not - this prevents double billing anything
                            try{
                                if (thisRecord.getValue('pnrefnum') || thisRecord.getValue('authcode')){
                                    thisRecord.setValue({fieldId :'custbody_authnet_use', value :false});
                                    form.getField({id: 'custbody_authnet_use'}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.DISABLED
                                    });
                                }
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
                                }
                                if ((b_responseFailure && thisRecord.getValue({fieldId: 'paymentmethod'}) === o_config2.custrecord_an_paymentmethod.val)) {
                                    context.newRecord.setValue({fieldId: 'custbody_authnet_use', value: false});
                                    //context.newRecord.setValue({fieldId :'memo', value :'hi there - big time'});
                                    s_field = s_field.replace(/%TYPE%/g, 'error');
                                    if (+o_history.responseCode === 4)
                                    {
                                        s_field = s_field.replace('%TITLE%', 'Payment Error - Suspected Fraud');
                                        s_field = s_field.replace('%DESCR%', o_history.responseCodeText + '<br/> Review the Authorize.net History record to approve or decline this pending authorization.');
                                    }
                                    else
                                    {
                                        s_field = s_field.replace('%TITLE%', s_paymentVehicle + ' Payment Error');
                                        s_field = s_field.replace('%DESCR%', o_history.message);
                                    }
                                    //fldWarning.setDefaultValue(s_field);
                                    fldWarning.defaultValue = s_field;
                                    //do not allow approval as SO does not have captured funds
                                    form.removeButton({id: 'approve'});
                                    form.removeButton({id: 'nextbill'});
                                    form.removeButton({id: 'billremaining'});
                                    //todo - remove cancel call to auth net if no auth
                                } else if (!_.isEmpty(thisRecord.getValue('custbody_authnet_authcode'))) {
                                    form.removeButton({id: 'void'});
                                    //dont let people uncheck the check mark now!
                                    try {
                                        form.getField({id: 'custbody_authnet_use'}).updateDisplayType({
                                            displayType: ui.FieldDisplayType.DISABLED
                                        });
                                        form.getField({id: 'paymentmethod'}).updateDisplayType({
                                            displayType: ui.FieldDisplayType.DISABLED
                                        });
                                    } catch (e) {
                                        log.error('Native CC Field Not on Form', form + ' missing ' + 'paymentmethod')
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
                                            log.error('Field Not on Form', form + ' missing ' + fld)
                                        }
                                    });
                                    //if there is a token on this approved and used record - leave it visable in view
                                    if (b_hasToken){
                                        //if it worked and is a token - make sure the token field is shown in view...
                                        form.getField({id: 'custbody_authnet_cim_token'}).updateDisplayType({
                                            displayType: ui.FieldDisplayType.NORMAL
                                        });
                                    }
                                    if (b_responseFailure)
                                    {
                                        var s_title = '';
                                        if (context.newRecord.getValue({fieldId:'custbody_authnet_authcode'}) === '(IMPORTED)'){
                                            s_title = 'IMPORTED AUTH : ';
                                        }
                                        s_title += o_history.status + ' ' + o_history.errorCode
                                        context.form.addPageInitMessage({
                                            type: message.Type.ERROR,
                                            title: s_title,
                                            message: o_history.message
                                        });
                                    }
                                }
                                b_doScripty = true;
                            }
                            break;
                        case 'cashrefund':
                        case 'customerrefund':
                            if(!context.newRecord.getValue({fieldId:'custbody_authnet_done'}) && (context.newRecord.getValue({fieldId :'custbody_authnet_use'}) || context.newRecord.getValue({fieldId: 'paymentmethod'})) === o_config2.custrecord_an_paymentmethod.val) {
                                if (!o_history.isValid) {
                                    context.form.addPageInitMessage({
                                        type: message.Type.ERROR,
                                        title: 'Refund Error',
                                        message: o_history.message
                                    });
                                    //s_field = s_field.replace(/%TYPE%/g, 'error');
                                    //s_field = s_field.replace('%TITLE%', 'Refund Error');
                                    //s_field = s_field.replace('%DESCR%', o_history.message);
                                    authNet.homeSysLog('refund parsehistory', o_history);
                                    //fldWarning.defaultValue = s_field;
                                }
                            }
                            try {
                                form.removeButton({
                                    id: 'void'
                                });
                            } catch (e){
                                //no log - who cares?
                            }
                            b_doScripty = true;
                            break;
                        case 'cashsale':
                            if(!context.newRecord.getValue({fieldId:'custbody_authnet_done'}) && (context.newRecord.getValue({fieldId :'custbody_authnet_use'}) || context.newRecord.getValue({fieldId: 'paymentmethod'})) === o_config2.custrecord_an_paymentmethod.val) {
                                var o_history = authNet.parseHistory(context.newRecord.id, context.newRecord.type);
                                if (!o_history.isValid) {
                                    //s_field = s_field.replace(/%TYPE%/g, 'error');
                                    //s_field = s_field.replace('%TITLE%', 'Refund Error');
                                    //s_field = s_field.replace('%DESCR%', o_history.message);
                                    authNet.homeSysLog('parsehistory', o_history);
                                    //fldWarning.defaultValue = s_field;
                                    context.form.addPageInitMessage({
                                        type: message.Type.ERROR,
                                        title: 'Refund Error',
                                        message: o_history.message
                                    });
                                }
                            }
                            try {
                                form.removeButton({
                                    id: 'void'
                                });
                            } catch (e){
                                //no log - who cares?
                            }
                            b_doScripty = true;
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
                        //s_field = s_field.replace(/%TYPE%/g, 'warning');
                        //s_field = s_field.replace('%TITLE%', 'Authorize.Net Override');
                        //s_field = s_field.replace('%DESCR%', 'This transaction will not process via Authorize.Net');
                        //fldWarning.setDefaultValue(s_field);
                        //fldWarning.defaultValue = s_field;
                        context.form.addPageInitMessage({
                            type: message.Type.WARNING,
                            title: 'Authorize.Net Override',
                            message: 'This transaction will not process via Authorize.Net and will not make any further calls to Authorize.Net'
                        });
                    }

                }
                else if (context.type === context.UserEventType.CREATE && context.newRecord.type === 'cashrefund' && (!context.newRecord.getValue({fieldId :'custbody_authnet_use'}) || context.newRecord.getValue({fieldId :'custbody_authnet_override'})))
                {
                    log.audit('Skipping cashrefund', 'Not authnet or overriden!')
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
                else if (context.type === context.UserEventType.CREATE && context.newRecord.getValue({fieldId :'custbody_authnet_use'}) && !context.newRecord.getValue({fieldId :'custbody_authnet_override'}))
                {
                    //ENSURE the response fields are hidden on a create since they would be empty
                    log.debug(context.newRecord.type + ' doing a CREATE here', 'from: ' + context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}));
                    //should be disabled
                    var setFields = (context.newRecord.getValue({fieldId: 'custbody_authnet_refid'})) ? ui.FieldDisplayType.DISABLED : ui.FieldDisplayType.HIDDEN;
                    //get values for doing work
                    var i_createdfrom = context.newRecord.getValue({fieldId: 'createdfrom'});
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
                        case 'cashsale':
                            //prevent anything crazy from going on if people already have a pnref
                            try{
                                if (context.newRecord.getValue('pnrefnum') || context.newRecord.getValue('authcode')){
                                    context.newRecord.setValue({fieldId :'custbody_authnet_use', value :false});
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
                                    context.newRecord.setValue({fieldId: 'custbody_authnet_datetime', value : ''});
                                    try {
                                        form.getField({id: 'paymentmethod'}).updateDisplayType({
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
                                    //custbody_authnet_override
                                }
                            } else {

                            }
                            break;
                        case 'customerdeposit':
                            log.debug('customerdeposit status : '+context.newRecord.getValue({fieldId: 'status'}), 'created from' + i_createdfrom)
                            //2 cases - from a SO or individual deposit
                            if (i_createdfrom){
                                if (context.newRecord.getValue({fieldId: 'custbody_authnet_refid'})){
                                    form.getField({id: 'custbody_authnet_use'}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.DISABLED
                                    });
                                    try {
                                        form.getField({id: 'paymentmethod'}).updateDisplayType({
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
                                    //custbody_authnet_override

                                }

                                b_doScripty = true;

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
                                    log.error('Field Not on Form', form + ' missing ' + fld)
                                }
                            });
                            b_doScripty = true;
                            break;
                        case 'invoice':
                            _.forEach(authNet.CCENTRY, function (fd) {
                                var fld = 'custbody_authnet_' + fd;
                                try {
                                    form.getField({id: fld}).updateDisplayType({
                                        displayType: ui.FieldDisplayType.HIDDEN
                                    });
                                } catch (e){
                                    log.error('Field Not on Form', form + ' missing ' + fld)
                                }
                            });
                            b_doScripty = false;
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
                            b_doScripty = false;
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
                            b_doScripty = true;
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

                if (b_doScripty){
                    var fld_scripty = form.addField({
                        id: 'custpage_scripty',
                        type: ui.FieldType.INLINEHTML,
                        label: 'scripty'
                    });

                    fld_scripty.defaultValue = "<script>" +
                        "jQuery( document ).ready(function() {" +
                        "var a_startingNum = [3,4,5,6];" +
                        "jQuery('#custbody_authnet_ccnumber').keyup(function(event) {" +
                        "if (this.value.length > 0){" +
                        "if (a_startingNum.indexOf(+this.value[0]) === -1){" +
                        "Ext.MessageBox.alert('Invalid Card Number', 'Please recheck the starting card number');" +
                        "} else if (isNaN(+this.value[this.value.length - 1])){" +
                        "Ext.MessageBox.alert('Invalid Card Number', 'Please enter only numbers');" +
                        "}" +
                        "}" +
                        "});" +
                        "jQuery('#custbody_authnet_ccexp').keyup(function(event) {" +
                        "if (this.value.length > 0){" +
                        "if (isNaN(+this.value[this.value.length - 1])){" +
                        "Ext.MessageBox.alert('Invalid Exp Date', 'Only Enter Numbers for MMYY');" +
                        "}" +
                        "}" +
                        "});" +
                        "jQuery('#custbody_authnet_ccv').keyup(function(event) {" +
                        "if (this.value.length > 0){" +
                        "if (isNaN(+this.value[this.value.length - 1])){" +
                        "Ext.MessageBox.alert('Invalid CCV', 'Only Enter Numbers for CCV values');" +
                        "} else if (this.value.length === 4){" +
                        "" +
                        "}" +
                        "}" +
                        "});" +
                        "});</script>";
                } else {
                    log.debug('No Scripty!', 'Not gonna do it...')

                    //log.debug('payment options',form.getField({id:'paymentmethod'}).getSelectOptions());

                    //'Authorize.Net (external)'
                }
                //log.debug('authNetBeforeLoad DONE : '+runtime.executionContext, context.type);
            } else if (context.type === context.UserEventType.CREATE && context.newRecord.getValue({fieldId :'custbody_authnet_use'}) && !context.newRecord.getValue({fieldId :'custbody_authnet_override'})){
                context.newRecord.setValue({fieldId: 'custbody_authnet_datetime', value : ''})
            }
        }
        function authNetBeforeSubmit(context) {
            //var o_config = authNet.getActiveConfig(context.newRecord);
            var o_config2 = authNet.getConfigFromCache();
            //check for EMPTY config on setup
            if (_.isUndefined(o_config2) || _.isEmpty(o_config2))
            {
                log.error('SuiteAuthConnect is not SET UP', 'Authorize.Net setup has not been complete!');
                return;
            }
            else if (o_config2.custrecord_an_enable.val) {
                log.debug('authNetBeforeSubmit via: '+runtime.executionContext, context.type +' on '+context.newRecord.type);
                //runtime.getCurrentSession().set({name: "anetConfig", value: JSON.stringify(o_config)});
                //manage external import of sales orders with auth
                if (context.newRecord.type === 'salesorder' && context.type === context.UserEventType.CREATE){
                    //var o_config = JSON.parse(runtime.getCurrentSession().get({name: "anetConfig"}));
                    if (o_config2.custrecord_an_external_auth_allowed.val){
                    //if (o_config.rec.getValue({fieldId: 'custrecord_an_external_auth_allowed'})){
                        if (context.newRecord.getValue({fieldId : o_config2.custrecord_an_external_fieldid.val}) && context.newRecord.getValue({fieldId : 'custbody_authnet_refid'})) {
                            context.newRecord.setValue({fieldId:'custbody_authnet_use', value : true});
                            context.newRecord.setValue({fieldId:'custbody_authnet_datetime', value : moment().toDate()});
                            if (_.isEmpty(context.newRecord.getValue({fieldId:'custbody_authnet_authcode'}))){
                                context.newRecord.setValue({fieldId:'custbody_authnet_authcode', value : '(IMPORTED)'});
                            }
                            if (o_config2.custrecord_an_make_deposit.val){
                                context.newRecord.setValue({fieldId:'paymentmethod', value: ''});
                            } else {
                                context.newRecord.setValue({fieldId:'paymentmethod', value: o_config2.custrecord_an_paymentmethod.val});
                            }
                        }
                        //added to ensure if you have checked authorize.net - the payment method is set 100% of the time
                    } else if (context.newRecord.getValue({fieldId:'custbody_authnet_use'})){
                        context.newRecord.setValue({fieldId:'paymentmethod', value: o_config2.custrecord_an_paymentmethod.val});
                    }


                } else if (context.type === context.UserEventType.DELETE && (context.newRecord.getValue({fieldId : 'custbody_authnet_refid'}) || context.oldRecord.getValue({fieldId : 'custbody_authnet_refid'})) && (context.newRecord.getValue({fieldId : 'custbody_authnet_datetime'}) || context.oldRecord.getValue({fieldId : 'custbody_authnet_datetime'}))){
                    if (!context.newRecord.getValue({fieldId : 'custbody_authnet_override'})){
                        throw '<span style=color:black;font-weight:bold;font-size:24px><p>TRANSACTION IS LINKED TO AUTHORIZE.NET - CAN NOT DELETE</p></span>'+
                            '<span style=color:red;font-weight:bold;font-size:24px>This transaction has been processed through a payment gateway <p> REFID is : ' + context.oldRecord.getValue('custbody_authnet_refid') + '</p>' +
                                '<p>You must use the appropriate transaction in NetSuite to undo / change this transaction (or save the record with override authorize.net checked and then edit / delete the record)</p></span>';
                    }
                } else if (context.type === context.UserEventType.CREATE && context.newRecord.getValue('custbody_authnet_use') && context.newRecord.getValue({fieldId: 'orderstatus'}) === 'A' && o_config2.custrecord_an_generate_token_pend_approv.val){
                    //so this is the create of a pending approval SO that can tokenize now
                    //can we tokenize:
                    if (!context.newRecord.getValue('custbody_authnet_cim_token')){
                        //no token on the transaction - so let's form a token out of the card data
                        //throw 'Dev Build - adding token on pending approval logic right now'
                    }

                    //log.audit('SO Approved & Has Token', 'Calling direct Auth on SO without plugin');
                    //todo - token logic goes here
                    //context.newRecord.setValue('custbody_token_instant_auth', true);
                    //authNet.getAuth(context.newRecord);
                } else if (context.type === context.UserEventType.APPROVE && +context.newRecord.getValue('custbody_authnet_cim_token') !== 0){
                    //log.audit('SO Approved & Has Token', 'Calling direct Auth on SO without plugin');
                    //todo - token logic goes here
                    //context.newRecord.setValue('custbody_token_instant_auth', true);
                    //authNet.getAuth(context.newRecord);
                } else if (context.newRecord.getValue('custbody_authnet_override')){
                    //context.newRecord.setValue('custbody_token_instant_auth', true);
                    context.newRecord.setValue('custbody_authnet_datetime','');
                    //context.newRecord.setValue('custbody_authnet_accountnumber','');
                    //context.newRecord.setValue('custbody_authnet_description','Credit card processing was overridden in NetSuite - no further credit card processing will occur on any related transaction in NetSuite');
                    //context.newRecord.setValue('custbody_authnet_reqrefid','');
                    //context.newRecord.setValue('custbody_authnet_responsecode','');
                }
                /*else if (context.type === context.UserEventType.XEDIT && context.newRecord.getValue('custbody_token_instant_auth') && +context.newRecord.getValue('custbody_authnet_responsecode') === 0){
                    authNet.getAuth(record.load({
                        type: record.Type.SALES_ORDER,
                        id: context.newRecord.id,
                        isDynamic: true
                    }));
                }*/
                log.debug('authNetBeforeSubmit : '+runtime.executionContext, context.type +' on '+context.newRecord.type + ' COMPLETED');
            }
        }
        function authNetAfterSubmit(context) {
            /*var licenceValidation;
            if (runtime.executionContext !== 'USERINTERFACE' ) {
                licenceValidation = authNet.validateLicence('authnetbasic');
                authNet.homeSysLog('Non UI get', licenceValidation)
            } else {
                licenceValidation = JSON.parse(runtime.getCurrentSession().get({name: 'licence'}));
                authNet.homeSysLog('licence from session in UI get', licenceValidation)
                if (_.isEmpty(licenceValidation)){
                    licenceValidation = authNet.validateLicence('authnetbasic');
                }
            }*/
            //todo - get the most recent log record and update the transaction???
            //var o_config = authNet.getActiveConfig(context.newRecord);
            var o_config2 = authNet.getConfigFromCache();

            authNet.homeSysLog('authNetAfterSubmit o_config2',o_config2);

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
            log.debug('authNetAfterSubmit : ' + runtime.executionContext, context.type +' on '+context.newRecord.type);
            //if (licenceValidation.valid && context.type !== context.UserEventType.DELETE && !context.newRecord.getValue('custbody_authnet_override')) {
            if (context.type !== context.UserEventType.DELETE && !context.newRecord.getValue('custbody_authnet_override')) {
                //log.debug('newRecord.orderstatus', context.newRecord.getValue('orderstatus')); //B when just approved
                //log.debug('oldRecord.orderstatus', context.oldRecord.getValue('orderstatus')); //A when pending approval
                var s_newStatus = context.newRecord.getValue('orderstatus');
                var s_oldStatus = (context.type === context.UserEventType.CREATE) ? 'A' : context.oldRecord.getValue('orderstatus');
                //log.debug('status old and new', s_oldStatus + ' : ' + s_newStatus);
                switch (context.newRecord.type) {
                    case 'salesorder':
                        var thisRec;
                        if (context.type === context.UserEventType.CANCEL) {
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
                                    thisRec.save({ignoreMandatoryFields : true});
                                }
                            }
                        } else {
                            //EXTERNAL AUTH LOGIC HERE
                            //log.debug(o_config2.custrecord_an_external_auth_allowed.val, context.newRecord.getValue(o_config2.custrecord_an_external_fieldid.val))
                            if (context.type === context.UserEventType.CREATE && o_config2.custrecord_an_external_auth_allowed.val && !_.isEmpty(context.newRecord.getValue(o_config2.custrecord_an_external_fieldid.val)))
                            { //runtime.executionContext !== 'USERINTERFACE'
                                if (o_config2.custrecord_an_external_auth_allowed.val){
                                    if (context.newRecord.getValue({fieldId : o_config2.custrecord_an_external_fieldid.val}) && context.newRecord.getValue({fieldId : 'custbody_authnet_refid'})) {
                                        //log.debug('the field is ' + o_config2.custrecord_an_external_fieldid.val, context.newRecord.getValue({fieldId : o_config2.custrecord_an_external_fieldid.val}));
                                        var b_continue = authNet.makeIntegrationHistoryRec(context.newRecord, o_config2);
                                        if (b_continue) {
                                            if (o_config2.custrecord_an_cim_auto_generate.val) {
                                                try {
                                                    authNet.getCIM(context.newRecord, o_config2);
                                                } catch (ex) {
                                                    log.error('Unable to generate CIM/Token off imported transaction', context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}) + ' reference ID failed to generate a CIM profile - check Authorize.Net for the validity of that transaction.')
                                                }
                                            }
                                            if (o_config2.custrecord_an_make_deposit.val) {
                                                try {
                                                    var o_status = authNet.getStatusCheck(context.newRecord.getValue({fieldId: 'custbody_authnet_refid'}));
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
                                                        rec_deposit.setValue({fieldId:'paymentmethod', value: o_config2.custrecord_an_paymentmethod.val});
                                                        rec_deposit.setValue({fieldId:'custbody_authnet_use', value: true});
                                                        rec_deposit.setValue({fieldId:'custbody_authnet_refid', value: context.newRecord.getValue({fieldId: 'custbody_authnet_refid'})});
                                                        rec_deposit.setValue({fieldId:'custbody_authnet_authcode', value: context.newRecord.getValue({fieldId: 'custbody_authnet_authcode'})});
                                                        rec_deposit.setValue({fieldId:'custbody_authnet_datetime', value: moment(context.newRecord.getValue({fieldId: 'custbody_authnet_datetime'})).toDate()});
                                                        rec_deposit.setValue({fieldId:'memo', value: 'WebStore Auth+Capture Deposit'});
                                                        var i_depositId = rec_deposit.save();
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
                                //TODO - kill payment method completly and set a field on the client
                                //var b_isTokenized = (context.newRecord.getValue('custbody_token_instant_auth') && +context.newRecord.getValue('custbody_authnet_cim_token') !== 0 );
                                var b_isTokenized = (_.toInteger(context.newRecord.getValue({fieldId :'custbody_authnet_cim_token'})) !== 0);
                                var pluginResult = plugin.loadImplementation({type: 'customscript_sac_txn_mgr_pi'}).testSO(context.newRecord);
                                if (pluginResult.process) {
                                //if (pluginResult.process || b_isTokenized  ) {
                                    //if there was a cc number, its auth.net and it's not already approved, let's do it!
                                    thisRec = authNet.getAuth(context.newRecord);
                                    //thisRec.setValue('custbody_token_instant_auth', false);
                                    if(!thisRec.getValue({fieldId :'custbody_authnet_refid'}) ){
                                        thisRec.setValue({fieldId :'custbody_authnet_use', value :false});
                                    } else {
                                        //so things coded but failed anyhow - like AVS issues
                                        if (thisRec.getValue({fieldId :'custbody_authnet_authcode'}) && !thisRec.getValue({fieldId :'custbody_authnet_error_status'})){
                                            //thisRec.setValue({fieldId :'ccapproved', value :true});
                                            if (!b_isTokenized && o_config2.custrecord_an_cim_auto_generate.val) {
                                                authNet.getCIM(thisRec, o_config2);
                                            }
                                        }
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
                            authNet.homeSysLog('o_cratedFrom', o_cratedFrom);
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
                        log.debug('customerpayment - status old and new');
                        var pluginResult = plugin.loadImplementation({type: 'customscript_sac_txn_mgr_pi'}).testCP(context.newRecord);
                        if (pluginResult.process) {
                            //if there was a cc number, its auth.net and it's not already approved, let's do it!
                            var o_response = authNet.getAuthCapture(context.newRecord);
                            authNet.homeSysLog('customerpayment - getAuthCapture - o_response', o_response);
                            authNet.handleResponse(o_response, context, true);
                        }
                        break;

                    case 'customerrefund':
                        log.debug(context.newRecord.type + ' - evaluating');
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
                            for(var i = txn.getLineCount('apply')-1; i>= 0; i--){
                                var b_toRefundId = txn.getSublistValue({sublistId: 'apply' , fieldId: 'apply', line:i});
                                if (b_toRefundId){
                                    a_txnObj.push({
                                        from : context.newRecord.id,
                                        fromType : context.newRecord.type,
                                        id : +txn.getSublistValue({sublistId: 'apply' , fieldId: 'doc', line:i}),
                                        amount : txn.getSublistValue({sublistId: 'apply' , fieldId: 'amount', line:i})
                                    });
                                }
                            }
                            for(var i = txn.getLineCount('deposit')-1; i>= 0; i--){
                                var b_toRefundId = txn.getSublistValue({sublistId: 'deposit' , fieldId: 'apply', line:i});
                                if (b_toRefundId){
                                    a_txnObj.push({
                                        from : context.newRecord.id,
                                        fromType : context.newRecord.type,
                                        id : +txn.getSublistValue({sublistId: 'apply' , fieldId: 'doc', line:i}),
                                        amount : txn.getSublistValue({sublistId: 'apply' , fieldId: 'amount', line:i})
                                    });
                                }
                            }
                            //log.debug('a_txnObj', a_txnObj)
                            var o_response = authNet.getBulkRefunds(txn, a_txnObj);
                            authNet.homeSysLog('customerrefund - getBulkRefunds - o_response', o_response);
                            authNet.homeSysLog('o_response', o_response)
                            //this is going to have to loop over the individual refund lines and refund EACH per transaction
                            authNet.handleResponse(o_response, context, false);
                        }
                        break;
                    default:
                        break;
                }
            }
            log.debug('authNetAfterSubmit : ' + runtime.executionContext, context.type +' on '+context.newRecord.type + ' FULLY COMPLETED!');
        }
        return {
            beforeLoad: authNetBeforeLoad,
            beforeSubmit: authNetBeforeSubmit,
            afterSubmit: authNetAfterSubmit
        };
    });