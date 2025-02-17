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
 * SweetAlert - https://sweetalert2.github.io
 */


define(['N/record', 'N/url', 'N/currentRecord', 'N/https', '../lib/sweetalert2.all.min'],
    function(record, url, currentRecord, https, Swal) {


        function pageInit(scriptContext) {
            // do nothing for now...
        }

        function setAuthVoid(scriptContext) {

            console.log('sweet!');
            window.jQuery("#custpage_voidauth").attr("disabled", true);
            Swal.fire({
                title: "Void Authorization?",
                text: "Are you sure you want to void this transaction?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Yes, void it!"
            }).then((result) => {
                if (result.isConfirmed) {
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
                        Swal.fire({
                            title: "Voided",
                            text: "The transaction has been voided.",
                            icon: "success"
                        });
                        var output = url.resolveRecord({
                            recordType: o_response.txn.type,
                            recordId: o_response.txn.id
                        });
                        console.log(output)
                        window.location = output;
                    }
                    else
                    {
                        Swal.fire({
                            title: "Unable to void transaction",
                            text: "The transaction has NOT been voided. You may need to investigate things inside of Authorize.Net",
                            icon: "error"
                        });
                    }
                }
            });
        }
        function doApprove(scriptContext) {

            window.jQuery("#custpage_approveauth").attr("disabled", true);
            window.jQuery("#custpage_declineauth").attr("disabled", true);

            Swal.fire({
                title: "Approve Authorization?",
                text: "Are you sure you want to approve this authorization?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Yes, approve it!"
            }).then((result) => {
                if (result.isConfirmed) {
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
                    else
                    {
                        Swal.fire({
                            title: "Unable to approve authorization",
                            text: "The transaction has NOT been approved. You may need to investigate things inside of Authorize.Net",
                            icon: "error"
                        });
                    }
                }
            });

        }
        function doDecline(scriptContext) {

            window.jQuery("#custpage_approveauth").attr("disabled", true);
            window.jQuery("#custpage_declineauth").attr("disabled", true);

            Swal.fire({
                title: "Decline Authorization?",
                text: "Are you sure you want to decline this authorization?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Yes, decline it!"
            }).then((result) => {
                if (result.isConfirmed) {
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
                    else
                    {
                        Swal.fire({
                            title: "Unable to decline authorization",
                            text: "The transaction has NOT been declined. You may need to investigate things inside of Authorize.Net",
                            icon: "error"
                        });
                    }
                }
            });
        }

        function getCIM(scriptContext) {

            window.jQuery("#custpage_redocim").attr("disabled", true);

            Swal.fire({
                title: "Request Token / CIM?",
                text: "Are you sure you want to request a token / CIM profile off this transaction?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Yes, get the token it!"
            }).then((result) => {
                if (result.isConfirmed) {
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
                    if (o_response.status){
                        var output = url.resolveRecord({
                            recordType: 'customer',
                            recordId: o_response.customer
                        });
                        console.log(output)
                        window.location = output;
                    }
                    else
                    {
                        Swal.fire({
                            title: "Unable to generate token",
                            text: "The token / CIM profile was unsuccessfully created. You may need to investigate things inside of Authorize.Net",
                            icon: "error"
                        });
                    }
                }
            });
        }

        return {
            pageInit: pageInit,
            setAuthVoid: setAuthVoid,
            getCIM: getCIM,
            doDecline : doDecline,
            doApprove : doApprove,
        };

    });