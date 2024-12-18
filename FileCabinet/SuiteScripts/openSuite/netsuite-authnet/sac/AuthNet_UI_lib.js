
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
 *
 * AuthorizeNet_lib.js
 * @NApiVersion 2.0
 * @NModuleScope Public
 *
 * @NAmdConfig ../config.json
 *
 */

define(["require", "exports", 'N/log', 'N/ui/serverWidget', 'N/ui/message', './AuthNet_lib',  'moment', 'lodash'],
    function (require, exports, log, ui, message,authNet, moment, _) {

    exports.notSetUpErrorCheck = function(form, o_config2){
        if (_.isUndefined(o_config2) || _.isEmpty(o_config2)) {
            log.error('SuiteAuthConnect is not SET UP', 'Authorize.Net setup has not been complete!');
            form.addPageInitMessage({
                type: message.Type.INFORMATION,
                title: 'AUTHORIZE.NET setup is INCOMPLETE',
                message: 'While this transaction may have nothing to do with Authorize.Net, the setup is incomplete and may cause unintended issues. An Administrator needs to complete the setup by navigating to <i>Cloud 1001 > SuiteAuthConnect > SuiteAuthConnect Configuration</i> and complete the setup.',
            });
            _.forEach(authNet.ALLAUTH, function (fldname) {
                try {
                    form.getField({id: 'custbody_authnet_' + fldname}).updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                } catch (e) {
                    log.error('UILIB.notSetUpErrorCheck() Field Not on Form anyhow!', form + ' missing and authNet Field - ' + fldname);
                }
            });
        }
        return form;
    }

    exports.buildConfigField = function(form, o_config2){
        var fld_config = form.addField({
            id: 'custpage_an_config',
            type: ui.FieldType.LONGTEXT,
            label: 'ANetCfg'
        }).updateDisplayType({
            displayType: ui.FieldDisplayType.HIDDEN
        });
        //pull this from cache if it's not there
        var o_publicConfig = {};
        _.forEach(o_config2, function(val, kie){
            if(!_.includes(authNet.SERVICE_CREDENTIAL_FIELDS, kie) && kie !== 'auth'){
                o_publicConfig[kie] = val;
            }
        });
        if (o_config2.mode === 'subsidiary')
        {
            o_publicConfig.subs = {};
            _.forEach(o_config2.subs, function(val, kie){
                o_publicConfig.subs[kie] = {};
                _.forEach(val, function (obj, ki){
                    if(!_.includes(authNet.SERVICE_CREDENTIAL_FIELDS, ki) && ki !== 'auth'){
                        o_publicConfig.subs[kie][ki] = obj;
                    }
                });
            });
        }
        //set the auth free config object in the custom field for the client scripts to know what to do!
        fld_config.defaultValue = JSON.stringify(o_publicConfig);
        return form;
    }

    return exports;
});


