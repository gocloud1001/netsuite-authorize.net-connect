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
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @NScriptType ScheduledScript
 *
 * @NAmdConfig ../config.json
 *
 */

define(["require", "exports", "N/record", "N/runtime", "N/config", "N/search", "N/email", "N/cache", "N/file", './AuthNet_lib'],
    function (require, exports, record, runtime, config, search, email, cache, file,  authNet) {

    function performConfig(){
        log.audit('Starting Install / Upgrade Config', 'Begining to apply any needed config changes based on Version '+authNet.VERSION);
        var companyInfo = config.load({ type: config.Type.COMPANY_INFORMATION });
        var installationInfo = {
            companyname: companyInfo.getValue({ fieldId: 'companyname' }),
            url: companyInfo.getValue({ fieldId: 'url' }),
            accountId: companyInfo.getValue({ fieldId: 'companyid' }),
            email: companyInfo.getValue({ fieldId: 'email' })
        };
        var s_notesString = '';
        var i_pmtMethod, i_achMethod;
        //add the mandatory payment method
        try {
            search.create({
                type: 'paymentmethod',
                filters: [['name', 'is','Authorize.Net' ]],
                columns: [
                    {name: 'internalid', sort: search.Sort.DESC}
                ]
            }).run().each(function (result) {
                i_pmtMethod = result.getValue('internalid');
                //this will only return the first one
                return false;
            });
            if (!i_pmtMethod) {
                var o_pmtRecord = record.create({
                    type: 'paymentmethod',
                    isDynamic: true
                });
                o_pmtRecord.setValue({fieldId: 'name', value: 'Authorize.Net'});
                i_pmtMethod = o_pmtRecord.save({ignoreMandatoryFields: true});
                log.audit('Upgrade Config', 'Payment Method for cards created');
            }
        } catch (e){
            s_notesString += e.name + ' : ' + e.message;
        }

        try {
            search.create({
                type: 'paymentmethod',
                filters: [['name', 'is','Authorize.Net (eCheck)' ]],
                columns: [
                    {name: 'internalid', sort: search.Sort.DESC}
                ]
            }).run().each(function (result) {
                i_achMethod = result.getValue('internalid');
                //this will only return the first one
                return false;
            });
            if (!i_achMethod) {
                var o_pmtRecord = record.create({
                    type: 'paymentmethod',
                    isDynamic: true
                });
                o_pmtRecord.setValue({fieldId: 'name', value: 'Authorize.Net (eCheck)'});
                i_achMethod = o_pmtRecord.save({ignoreMandatoryFields: true});
                log.audit('Upgrade Config', 'Payment Method for eChecks created');
            }
        } catch (e){
            s_notesString += e.name + ' : ' + e.message;
        }

        var s_oldVersionNumber = 'NEW';
        try {
            //var o_config = authNet.getActiveConfig();
            //won't use config JSON
            var a_filters = [
                ['isinactive', 'is', 'F'],
                //"AND",
                //['custrecord_an_all_sub', 'is', 'T']
            ];
            var authnetconfig = search.create({
                type: 'customrecord_authnet_config',
                //filters: a_filters,
                filters: a_filters,
                columns: [
                    {name: 'internalid', sort: search.Sort.DESC}
                ]
            }).run();
            var i_configRecId;
            authnetconfig.each(function (result) {
                i_configRecId = result.getValue('internalid');
                //this will only return the first one
                return false;
            });
            log.audit('Config', 'Prepping logic for config id: '+i_configRecId);
            var o_configRecord;
            if (i_configRecId){
                log.audit('Upgrade Config', 'Loading Config Record ID '+i_configRecId);
                o_configRecord = record.load({
                    type : 'customrecord_authnet_config',
                    id : i_configRecId,
                    isDynamic : true
                });
                s_oldVersionNumber = o_configRecord.getValue({fieldId : 'custrecord_an_version'});
            } else {
                log.audit('Installation Config', 'Creating NEW Config Record');
                o_configRecord = record.create({
                    type : 'customrecord_authnet_config',
                    isDynamic : true
                });
                try {
                    o_configRecord.setValue({fieldId: 'name', value: companyInfo.getValue({ fieldId: 'companyname' }) + ' Gateway'});
                } catch (ex) {
                    s_notesString += ex.name + ' : ' + ex.message + '<br>';
                }

                try {
                    //todo to allow multi sub
                    if (!o_configRecord.getValue({fieldId: 'custrecord_an_all_sub'})) {
                        o_configRecord.setValue({fieldId: 'custrecord_an_all_sub', value: true});
                    }
                } catch (ex) {
                    s_notesString += ex.name + ' : ' + ex.message + '<br>';
                }
            }
            o_configRecord.setValue({fieldId : 'custrecord_an_version', value: authNet.VERSION});
            try {
                if (!o_configRecord.getValue({fieldId: 'custrecord_an_instanceid'})) {
                    o_configRecord.setValue({fieldId: 'custrecord_an_instanceid', value: companyInfo.getValue({ fieldId: 'companyid' })});
                }
            } catch (ex){
                s_notesString += ex.name + ' : ' + ex.message + '<br>';
            }
            try {
                if (!o_configRecord.getValue({fieldId: 'custrecord_an_txn_companyname'})) {
                    o_configRecord.setValue({fieldId: 'custrecord_an_txn_companyname', value: companyInfo.getValue({ fieldId: 'companyname' })});
                }
            } catch (ex){
                s_notesString += ex.name + ' : ' + ex.message + '<br>';
            }
            try {
                if (!o_configRecord.getValue({fieldId: 'custrecord_an_paymentmethod'})) {
                    o_configRecord.setValue({fieldId: 'custrecord_an_paymentmethod', value: i_pmtMethod});
                }
            } catch (ex){
                s_notesString += ex.name + ' : ' + ex.message + '<br>';
            }
            try {
                if (!o_configRecord.getValue({fieldId: 'custrecord_an_paymentmethod_echeck'})) {
                    o_configRecord.setValue({fieldId: 'custrecord_an_paymentmethod_echeck', value: i_achMethod});
                }
            } catch (ex){
                s_notesString += ex.name + ' : ' + ex.message + '<br>';
            }
            try {
                o_configRecord.setValue({fieldId: 'custrecord_an_show_versions', value: true});
            } catch (ex){
                s_notesString += ex.name + ' : ' + ex.message + '<br>';
            }
            /* NOT NEEDED - Embeded into html page
            try {
                search.create({
                    type: 'file',
                    filters: [
                        ['name', 'is', 'authnet_click2pay_onlinepayment_vaildation.js'],
                    ],
                    columns:
                        [
                            'url',
                            'availablewithoutlogin',
                        ]
                }).run().each(function (result)
                {

                    if (!result.getValue('availablewithoutlogin')) {
                        let _tmp = file.load({id: result.id});
                        _tmp.isOnline = true;
                        _tmp.save();
                        log.audit('JS Click2Pay file updated', 'Click2Pay file has been updated to allow external access');
                    }
                    return true;
                });
            } catch (ex){
                s_notesString += ex.name + ' : ' + ex.message + '<br>';
            }*/

            o_configRecord.setValue({fieldId: 'custrecord_an_cim_allow_tokens', value: true});
            o_configRecord.setValue({fieldId: 'custrecord_an_skip_on_save', value: true});
            //added because sometimes the cache gets cranky on the creation of a new record.
            try {
                var daCache = cache.getCache(
                    {
                        name: 'config',
                        scope: cache.Scope.PROTECTED
                    }
                );
                daCache.remove({
                    key: 'config'
                });
            } catch (ex){
                s_notesString += ex.name + ' : ' + ex.message + '<br>';
            }

            o_configRecord.save({ignoreMandatoryFields: true});
        } catch (e){
            s_notesString += e.name + ' : ' + e.message;
        }
        if (s_notesString){
            log.audit('Upgraded', s_notesString)
        }
        //purge the cache to make sure any new cache config options are correctly loaded with the new code
        authNet.purgeCache();

        //this can obviously be removed - but it's nice to let us know who is installing and who is updating so we have some idea!
        //we currently do NOT do anything with this information aside from count the number of times things are happening
        //if Cloud 1001, LLC chooses to add any sort of future notification of releases or anything -
        //we will provide an opt-in to this at installation time
        var o_user = runtime.getCurrentUser();
        //log.debug('o_user',o_user);
        if (o_user.id !== -4) {
            var s_toEmail = 'Company : ' + installationInfo.companyname + '<br />' +
                'Admin Email : ' + installationInfo.email + '<br />' +
                'Installed By : ' + o_user.name + '<br />' +
                'Installed By Email : ' + o_user.email + '<br />' +
                s_notesString;
            log.audit('Sending installation email from ID:' + o_user.id, o_user.name);
            email.send({
                author: o_user.id,
                recipients: 'suiteauthconnect@gocloud1001.com',
                subject: 'SuiteAuthConnect SDF Config ' + s_oldVersionNumber + ' >> ' + authNet.VERSION,
                body: s_toEmail
            });
        }
        else
        {
            log.audit('Can not send email', 'Run by system manaully, no user to send from');
        }
    }

    return {
        execute : performConfig
    }
});
