/**
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
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 * @NModuleScope Public
 *
 */


define(['N/record', 'N/url', 'N/currentRecord', 'N/ui/dialog', '../lib/lodash.min'],
    function(record, url, currentRecord, dialog, _) {


        function pageInit(context) {
            // do nothing for now...
            try {

                var _fld = context.currentRecord.getField({
                    fieldId: 'custpage_change_sub'
                });
                _fld.isVisible = false;
                _fld.isDisplay = false;
                _fld.isDisabled = true;
            }
            catch (e)
            {
                //might not work
            }
        }

        function fieldChanged(context)
        {
            if (context.fieldId === 'custrecord_an_all_sub')
            {
                if (!context.currentRecord.getValue({fieldId:'custrecord_an_all_sub'}))
                {
                    var button1 = {
                        label: 'YES - I understand that this is a one way decision and that failing to configure a subsidiary ' +
                            'with any gateway information will result in that subsidiary being unable to transact with Authorize.Net. ' +
                            'I also understand the same Authorize.Net credentials may be used in different subsidiaries ' +
                            'to "share" the gateway, but each subsidiary must be configured independently even if ' +
                            'the credentials are to be shared.',
                        value: 1
                    };
                    var button2 = {
                        label: 'No - I do not want to change this. I want to keep things simple and use a single Authorize.net account for all my subsidiaries OR ' +
                            'I do not use subsidiaries.',
                        value: 2
                    };

                    var options = {
                        title: '❗ WARNING ❗',
                        message: 'You are about to make <b style="color:red;">significant configuration change</b>. ' +
                            'This change may cause disruption to Authorize.Net processing inside of NetSuite while you set up each subsidiary profile',
                        buttons: [button1, button2]
                    };

                    function success(result) {
                        var _fld = context.currentRecord.getField({
                            fieldId: 'custpage_change_sub'
                        });
                        if (+result === 1) {
                            _fld.isVisible = true;
                            _fld.isDisplay = true;
                            _fld.isDisabled = false;
                            _fld.isMandatory = true;
                        }
                        else
                        {
                            context.currentRecord.setValue({fieldId:'custrecord_an_all_sub', value :true, ignoreFieldChange : true});
                            _fld.isVisible = false;
                            _fld.isDisplay = false;
                            _fld.isDisabled = true;
                            _fld.isMandatory = false;
                        }
                        return true;
                    }

                    function failure(reason) {
                        log.debug('Failure: ' + reason);
                        alert(reason)
                    }
                    dialog.create(options).then(success).catch(failure);
                }
            }
            else if (context.fieldId === 'custrecord_an_break_pci')
            {
                if (context.currentRecord.getValue({fieldId:'custrecord_an_break_pci'})) {
                    //put a big acceptance alert here that you are breaking PCI compliance
                    var button1 = {
                        label: 'NO - I do not want to change the logging of data to be non-PCI compliant',
                        value: 2
                    };
                    var button2 = {
                        label: 'YES - I want to knowingly break PCI compliance and log to the Script Logs in NetSuite personal and private payment card data.',
                        value: 1
                    };

                    var options = {
                        title: '❗ PCI COMPLIANCE WARNING ❗',
                        message: 'You are about to be in <b style="color:red;">VIOLATION OF PCI STANDARDS AND COMPLIANCE</b>. ' +
                            'This change may result in the logging of PII including customer names, credit card information and values.  This is a global setting, you CAN enable this on a per script setting on the User Event deployment of the "SuiteAuthConnect Transaction Manager" script on the record you want to debug.  This is the recommended approach vs enabling this global setting.',
                        buttons: [button2, button1]
                    };

                    function success(result) {
                        //log.debug('Success with value ' + result);
                        if (+result === 2) {
                            context.currentRecord.setValue({
                                fieldId: 'custrecord_an_break_pci',
                                value: false,
                                ignoreFieldChange: true
                            });
                        }

                        return true;
                    }
                    function failure(reason) {
                        log.debug('Failure: ' + reason);
                        alert(reason)
                    }
                    dialog.create(options).then(success).catch(failure);
                }
            }
            else if (context.fieldId === 'custrecord_an_enable_click2pay_inv')
            {
                if (context.currentRecord.getValue({fieldId:'custrecord_an_enable_click2pay_inv'})) {
                    //put a big acceptance alert here that you have other steps to fulfill
                    var button1 = {
                        label: 'NO - I do not want to perform additional steps to enable Click 2 Pay',
                        value: 2
                    };
                    var button2 = {
                        label: 'YES - I want to enable Click 2 Pay functionality and have generated my API secret',
                        value: 1
                    };
                    var s_tempPassword = _.times(32, () => _.random(35).toString(36)).join('');
                    var options = {
                        title: 'Click 2 Pay Feature Enablement',
                        message: 'Before you can enable Click 2 Pay, you must have set up your API Secret.<br/>' +
                            'The API Secret is generated by navigating to <a target="_blank" href="/app/common/scripting/secrets/settings.nl?whence=">Setup > Company > API Secrets</a> and creating a new secret with the name of "<b>Authorize.net Click2Pay</b>" and the ID of "<b>_authnet_payment_link</b>".<br/> Allow For All Scripts and Restrict To Domains of "Authorize.net". The password you enter will be used for encrypting the Click 2 Pay link and is of your choosing but MUST BE EXACTLY 16, 24, or 32 charcters long<br>' +
                            'Here is a 32 character random string you can use for your password : <i>'+s_tempPassword+'</i>'+
                            '<br><br><b style="color:red;">Failure to perfom this step before enabling this feature may result in unexpected bahavior</b>.',
                        buttons: [button2, button1]
                    };

                    function success(result) {
                        //log.debug('Success with value ' + result);
                        if (+result === 2) {
                            context.currentRecord.setValue({
                                fieldId: 'custrecord_an_enable_click2pay_inv',
                                value: false,
                                ignoreFieldChange: true
                            });
                        }

                        return true;
                    }
                    function failure(reason) {
                        log.debug('Failure: ' + reason);
                        alert(reason)
                    }
                    dialog.create(options).then(success).catch(failure);
                }
            }
        }

        function saveRecord (context){
            var b_return = true;
            log.debug('custpage_change_sub isVisible?', context.currentRecord.getField({
                fieldId: 'custpage_change_sub'
            }).isVisible);
            if (context.currentRecord.getField({
                fieldId: 'custpage_change_sub'
            }).isVisible)
            {
                if (!context.currentRecord.getValue({fieldId: 'custpage_change_sub'}))
                {
                    function success(result) { console.log('Success with value: ' + result) }
                    function failure(reason) { console.log('Failure: ' + reason) }
                    dialog.alert({
                        title: 'Initial Subsidiary Setup is REQUIRED',
                        message: 'You MUST enter the subsidiary you are migrating this gateway to before saving in the field <b>Initial Subsidiary Setup</b>.  ' +
                            'That Subsidiary will be used to update all payment profiles / tokens already recorded against the active gateway configuration.  ' +
                            'If you have a lot of profiles / tokens already, you may want to disable the main <i>ENABLE CONFIGURATION</i> check box and do this upgrade during off hours.'
                    }).then(success).catch(failure);
                    b_return = false;
                }
            }
            return b_return;
        }


        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            saveRecord: saveRecord,

        };

    });