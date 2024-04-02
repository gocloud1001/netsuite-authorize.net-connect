/**
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
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 * @NModuleScope Public
 *
 */


define(['N/record', 'N/url', 'N/currentRecord', 'N/https'],
    function(record, url, currentRecord, https) {


        function pageInit(scriptContext) {
            // do nothing for now...
        }

        function setAuthVoid(scriptContext) {
            window.Ext.MessageBox.show({
                title: 'Voiding',
                msg: '<span>Voiding this authorization... </span>',
                width: 400,
                icon: Ext.MessageBox.PROGRESS,
                closable: false
            });
            window.jQuery("#custpage_voidauth").attr("disabled", true);
            
            //console.log('done')
            //return;
            var curr_rec = currentRecord.get();
            var rec_id = curr_rec.id;
            //call a the suitelet to void this
            var domain_url = 'https://';
            domain_url += url.resolveDomain({
                hostType: url.HostType.APPLICATION,
            });
            var suitelet_url = domain_url + url.resolveScript({
                scriptId: 'customscript_c9_authnet_screen_svc',
                deploymentId: 'customdeploy_sac_authnet_screen_svc'
            }) + '&_id='+rec_id+'&doAuthVoid=true&_type='+curr_rec.type;
            //then redirect to the record as voided
            var response = https.get({
                url: suitelet_url
            });
            console.log(response)
            console.log(response.body)
            //alert(suitelet_url);
            var o_response = JSON.parse(response.body)
            if (o_response.status){
                var output = url.resolveRecord({
                    recordType: o_response.txn.type,
                    recordId: o_response.txn.id
                });
                console.log(output)
                window.location = output;
            }
        }
        function doApprove(scriptContext) {
            window.Ext.MessageBox.show({
                title: 'Approving',
                msg: '<span>Approving this authorization... </span>',
                width: 400,
                icon: Ext.MessageBox.PROGRESS,
                closable: false
            });
            window.jQuery("#custpage_approveauth").attr("disabled", true);
            window.jQuery("#custpage_declineauth").attr("disabled", true);

            //console.log('done')
            //return;
            var curr_rec = currentRecord.get();
            var rec_id = curr_rec.id;
            //call a the suitelet to void this
            var domain_url = 'https://';
            domain_url += url.resolveDomain({
                hostType: url.HostType.APPLICATION,
            });
            var suitelet_url = domain_url + url.resolveScript({
                scriptId: 'customscript_c9_authnet_screen_svc',
                deploymentId: 'customdeploy_sac_authnet_screen_svc'
            }) + '&_id='+rec_id+'&fraudAuthApprove=approve&_type='+curr_rec.type;
            //then redirect to the record as voided
            var response = https.get({
                url: suitelet_url
            });
            console.log('response')
            console.log(response.body)
            //alert(suitelet_url);
            var o_response = JSON.parse(response.body)
            if (o_response.status){
                var output = url.resolveRecord({
                    recordType: o_response.fromType,
                    recordId: o_response.fromId
                });
                console.log(output)
                window.location = output;
            }
        }
        function doDecline(scriptContext) {
            window.Ext.MessageBox.show({
                title: 'Declining',
                msg: '<span>Declining this authorization... </span>',
                width: 400,
                icon: Ext.MessageBox.PROGRESS,
                closable: false
            });
            window.jQuery("#custpage_approveauth").attr("disabled", true);
            window.jQuery("#custpage_declineauth").attr("disabled", true);

            //console.log('done')
            //return;
            var curr_rec = currentRecord.get();
            var rec_id = curr_rec.id;
            //call a the suitelet to void this
            var domain_url = 'https://';
            domain_url += url.resolveDomain({
                hostType: url.HostType.APPLICATION,
            });
            var suitelet_url = domain_url + url.resolveScript({
                scriptId: 'customscript_c9_authnet_screen_svc',
                deploymentId: 'customdeploy_sac_authnet_screen_svc'
            }) + '&_id='+rec_id+'&fraudAuthApprove=decline&_type='+curr_rec.type;
            //then redirect to the record as voided
            var response = https.get({
                url: suitelet_url
            });
            console.log(response)
            console.log(response.body)
            //alert(suitelet_url);
            var o_response = JSON.parse(response.body)
            if (o_response.status){
                var output = url.resolveRecord({
                    recordType: o_response.fromType,
                    recordId: o_response.fromId
                });
                console.log(output)
                window.location = output;
            }
        }

        function getCIM(scriptContext) {
            window.Ext.MessageBox.show({
                title: 'Requesting Token',
                msg: '<span>Requesting Card Token... </span>',
                width: 400,
                icon: Ext.MessageBox.PROGRESS,
                closable: false
            });
            window.jQuery("#custpage_redocim").attr("disabled", true);

            //console.log('done')
            //return;
            var curr_rec = currentRecord.get();
            var rec_id = curr_rec.id;
            //call a the suitelet to void this
            var domain_url = 'https://';
            domain_url += url.resolveDomain({
                hostType: url.HostType.APPLICATION,
            });
            var suitelet_url = domain_url + url.resolveScript({
                scriptId: 'customscript_c9_authnet_screen_svc',
                deploymentId: 'customdeploy_sac_authnet_screen_svc'
            }) + '&_id='+rec_id+'&getCIM=true&_type='+curr_rec.type;
            //then redirect to the record as voided
            var response = https.get({
                url: suitelet_url
            });
            console.log(response)
            console.log(response.body)
            //alert(suitelet_url);
            var o_response = JSON.parse(response.body)
            if (o_response.success){
                var output = url.resolveRecord({
                    recordType: 'customer',
                    recordId: o_response.customer
                });
                console.log(output)
                window.location = output;
            }
        }

        return {
            pageInit: pageInit,
            setAuthVoid: setAuthVoid,
            getCIM: getCIM,
            doDecline : doDecline,
            doApprove : doApprove,
        };

    });