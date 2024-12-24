
/**
 * Module Description...
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
 * @NScriptType MapReduceScript
 *
 * @NAmdConfig ../config.json
 */
define(['exports', 'N/record', 'N/search', 'N/runtime', 'lodash', './AuthNet_lib'],
function (exports, record, search, runtime, _, authNet) {
    exports.getInputData = function () {
        log.audit('starting the getInputs for Authorize.Net Token Update', 'mapping and reducing shall commence!');
        var a_profilesToUpdate = [];
        var this_Script = runtime.getCurrentScript();
        if (this_Script.deploymentId === 'customdeploy_sac_update_profiles')
        {

            var results_profile_search = search.create({
                type: 'customrecord_authnet_tokens',
                filters: [
                    ['custrecord_an_token_pblkchn_tampered', 'is', 'F'],
                    "AND",
                    ['isinactive', 'is', 'F'],
                    "AND",
                    ['custrecord_an_token_gateway_sub', 'anyof', '@NONE@'],
                    "AND",
                    ['custrecord_an_token_subsidiary', 'anyof', '@NONE@']
                ]
            }).run();

            var i_range = 1000, b_hasMore = true;
            while (b_hasMore) {
                var i_resultCount = 0;
                var results = results_profile_search.getRange({
                    start: (i_range - 1000), //Index number of the first result to return, inclusive
                    end: i_range //Index number of the last result to return, exclusive
                });
                //log.debug('results', results)
                _.forEach(results, function (val) {
                    //log.debug('val', val)
                    var obj = {
                        rectype: val.recordType,
                        id: +val.id,
                        source : this_Script.deploymentId,
                        gateway: this_Script.getParameter({name: 'custscript_an_gateway_sub'}),
                        subsidiary: this_Script.getParameter({name: 'custscript_an_subsidiary'})
                    };
                    a_profilesToUpdate.push(obj);
                    i_resultCount++;
                    return true;
                });
                log.audit('in the process of counting in range ' + (i_range - 1000) + ' to ' + i_range, i_resultCount);
                b_hasMore = i_resultCount === 1000;
                i_range += 1000;
            }
            log.audit('Raw Profile record count is : ' + _.size(a_profilesToUpdate), 'Now commencing with the SUBSIDIARY updates!');
        }
        else if (this_Script.deploymentId === 'customdeploy_sac_update_profiles_up')
        {
            var results_profile_search = search.create({
                type: 'customrecord_authnet_tokens',
                filters : [
                    ['custrecord_an_token_paymenttype', 'anyof', '@NONE@'],
                    "AND",
                    ['isinactive', 'is', 'F'],
                    "AND",
                    ['custrecord_an_token_pblkchn_tampered', 'is', 'F']
                ]
            }).run();

            var i_range = 1000, b_hasMore = true;
            while (b_hasMore) {
                var i_resultCount = 0;
                var results = results_profile_search.getRange({
                    start: (i_range - 1000), //Index number of the first result to return, inclusive
                    end: i_range //Index number of the last result to return, exclusive
                });
                //log.debug('results', results)
                _.forEach(results, function (val) {
                    //log.debug('val', val)
                    var obj = {
                        rectype: val.recordType,
                        id: +val.id,
                        source : this_Script.deploymentId,
                    };
                    a_profilesToUpdate.push(obj);
                    i_resultCount++;
                    return true;
                });
                log.audit('in the process of counting in range ' + (i_range - 1000) + ' to ' + i_range, i_resultCount);
                b_hasMore = i_resultCount === 1000;
                i_range += 1000;
            }
            log.audit('Raw Profile record count is : ' + _.size(a_profilesToUpdate), 'Now commencing with the METHOD updates!');

        }
        return a_profilesToUpdate;
    };

    exports.map = function (context) {
        var recToChange = JSON.parse(context.value);
        log.debug('recToChange', recToChange)
        try {
            //load and save - xedit's will kill the hash and mark the token as tampered!
            var o_profile = record.load({
                type: recToChange.rectype,
                id: recToChange.id,
                isDynamic: true
            });
            if (recToChange.source === 'customdeploy_sac_update_profiles')
            {
                if (+o_profile.setValue({fieldId:'custrecord_an_token_paymenttype'}) === 0 )
                {
                    o_profile.setValue({fieldId:'custrecord_an_token_paymenttype', value : 1});
                }
                o_profile.setValue({fieldId:'custrecord_an_token_gateway_sub', value : recToChange.gateway});
                o_profile.setValue({fieldId:'custrecord_an_token_subsidiary', value : recToChange.subsidiary});
                log.audit('token / profile updated ', recToChange.id +' id was updated to support SUBSIDARIES');
            }
            else if (recToChange.source === 'customdeploy_sac_update_profiles_up')
            {
                o_profile.setValue({fieldId:'custrecord_an_token_paymenttype', value : 1});
                log.audit('token / profile updated ', recToChange.id +' id was updated to support PAYMENT TYPES');
            }
            o_profile.save({ignoreMandatoryFields:true});
        } catch (ex){
            log.error(ex.name, ex.message);
        }
    };

    exports.summarize = function(summary) {
        var type = summary.toString();

        log.audit(type + ' Usage Consumed', summary.usage);
        log.audit(type + ' Number of Queues', summary.concurrency);
        log.audit(type + ' Number of Yields', summary.yields);
        log.audit('Input Time Elapsed', summary.inputSummary.seconds);
        log.audit('Map Time Elapsed', summary.mapSummary.seconds);
        log.audit(type + ' Total seconds elapsed', summary.seconds);
        log.audit('DONE','All done - everything should be updated');
    }
});