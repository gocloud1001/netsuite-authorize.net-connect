/**
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
 * @NScriptType ScheduledScript
 *
 * @NAmdConfig ../config.json
 *
 */

define(["require", "exports", "N/record", "N/runtime", "N/config", "N/search", "N/email", './AuthNet_lib'],
    function (require, exports, record, runtime, config, search, email,authNet) {

    function performConfig(){
        var companyInfo = config.load({ type: config.Type.COMPANY_INFORMATION });
        var installationInfo = {
            companyname: companyInfo.getValue({ fieldId: 'companyname' }),
            url: companyInfo.getValue({ fieldId: 'url' }),
            accountId: companyInfo.getValue({ fieldId: 'companyid' }),
            email: companyInfo.getValue({ fieldId: 'email' })
        };
        var s_notesString = '';
        var i_pmtMethod;
        //add the mandatory payment method
        try {
            var i_pmtMethod;
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
                "AND",
                ['custrecord_an_all_sub', 'is', 'T']
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
            var o_configRecord;
            if (i_configRecId){
                o_configRecord = record.load({
                    type : 'customrecord_authnet_config',
                    id : i_configRecId,
                    isDynamic : true
                });
                s_oldVersionNumber = o_configRecord.getValue({fieldId : 'custrecord_an_version'});
            } else {
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
                    if (!o_configRecord.getValue({fieldId: 'custrecord_an_all_sub'})) {
                        o_configRecord.setValue({fieldId: 'custrecord_an_all_sub', value: true});
                    }
                } catch (ex) {
                    s_notesString += ex.name + ' : ' + ex.message + '<br>';
                }
            }
            o_configRecord.setValue({fieldId : 'custrecord_an_version', value: authNet.VERSION});

            if (!o_configRecord.getValue({fieldId : 'custrecord_an_all_sub'})){
                o_configRecord.setValue({fieldId : 'custrecord_an_all_sub', value: true});
            }
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
            o_configRecord.save({ignoreMandatoryFields: true});
        } catch (e){
            s_notesString += e.name + ' : ' + e.message;
        }
        //this can obviously be removed - but it's nice to let us know who is installing and who is updating
        email.send({
            author: -5,
            recipients: 'suiteauthconnect@gocloud1001.com',
            subject: 'UPDATE SuiteAuthConnect SDF Config '+ s_oldVersionNumber + ' >> '+ authNet.VERSION,
            body: JSON.stringify(installationInfo)+ '<br>'+ s_notesString
        });
    }

    return {
        execute : performConfig
    }
});
