/**
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
 * @author Andy Prior <andy@gocloud1001.com>
 *
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/url', 'N/currentRecord'],

    function(record, search, url, currentRecord) {
        function getParameterByName(name) {
            name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
            var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                results = regex.exec(location.search);
            return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
        }
        function fieldChanged(context){
            console.log(context);
            console.log(context.fieldId)
            var o_config = JSON.parse(context.currentRecord.getValue('custpage_rawconfig'));
            if (context.fieldId === 'custpage_configrec'){
                //set the selected config to a hidden field for teh rest of the process (token getting)
                if (context.currentRecord.getValue('custpage_configrec'))
                {

                    var o_sub = search.lookupFields({
                        type:'customrecord_authnet_config_subsidiary',
                        id : context.currentRecord.getValue('custpage_configrec'),
                        columns : 'custrecord_ancs_subsidiary'
                    });
                    console.log(o_sub)
                    console.log(o_config)
                    //var o_masterConfig = JSON.parse(context.currentRecord.getValue('custpage_rawconfig'));
                    var o_newConfig = o_config.subs['subid' + o_sub.custrecord_ancs_subsidiary[0].value];
                    //context.currentRecord.setValue('custpage_currentconfig', JSON.stringify(o_newConfig));
                    if (!o_newConfig)
                    {
                        context.currentRecord.setValue({fieldId:'custpage_configrec', value: '', ignoreFieldChange:true});
                        alert('That Subsidiary Configuration is not active - visit the record to enable it if you want to test with it');
                    }
                    else {
                        if (window.onbeforeunload) {
                            window.onbeforeunload = function ()
                            {
                                null;
                            };
                        }
                        if (o_newConfig.isSubConfig) {
                            location.replace(location.href + '&sub=true&config=' + o_newConfig.configid);
                            //window.location.replace(window.location.href + '&sub=true&config=' + o_newConfig.configid);
                        } else {
                            location.replace(location.href + '&sub=false');
                        }
                    }
                }
            }
            if (context.fieldId === 'customer') {
                var config = context.currentRecord.getValue('custpage_configrec');
                if (context.currentRecord.getValue({fieldId: 'customer'})) {
                    var custId = context.currentRecord.getValue({fieldId: 'customer'});
                    if (window.onbeforeunload) {
                        window.onbeforeunload = function () { null; };
                    }
                    if (o_config.isSubConfig) {
                        window.location.replace(window.location.href + '&customer='+custId+'&sub=true&config=' + config);
                    } else {
                        window.location.replace(window.location.href + '&customer='+custId+'&sub=false');
                    }
                }
            }
        }

        function pageInit(context){
            //console.log('sub? '+getParameterByName('sub'));
        }


        return {
            fieldChanged: fieldChanged,
            pageInit : pageInit,
            //saveRecord : saveRecord
        };

    });
