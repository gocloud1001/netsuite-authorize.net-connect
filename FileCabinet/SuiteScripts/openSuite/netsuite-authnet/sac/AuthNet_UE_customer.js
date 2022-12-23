/**
 * Module Description...
 *
 * @exports XXX
 *
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
 * @NApiVersion 2.0
 * @NModuleScope Public
 * @NScriptType UserEventScript
 *
 * @NAmdConfig ../config.json
 */


define(['N/record', 'N/runtime', 'N/ui/serverWidget', 'lodash', 'moment'],
    function (record,  runtime, ui, _, moment) {

        function beforeLoad(context) {
            try {
                //if (context.type === 'view') {
                var dev_script = context.form.addField({
                    id: 'custpage_dev_script',
                    label: 'typeahed',
                    type : ui.FieldType.INLINEHTML
                });
                dev_script.defaultValue =
                    '<script>jQuery( document ).ready(function() {\n' +
                    'jQuery("#recmachcustrecord_an_token_entity_existingrecmachcustrecord_an_token_entity_fs_lbl_uir_label").hide();\n' +
                    'jQuery("#recmachcustrecord_an_token_entity_existingrecmachcustrecord_an_token_entity_fs").hide();\n' +
                    'jQuery("#recmachcustrecord_an_token_entity_main_form #tdbody_attach").hide();\n' +
                    '});</script>';
                //}
            }
            catch (ex)
            {
                log.error(ex.name, ex.message);
            }


        }
        function beforeSubmit(context) {
        }
        function afterSubmit(context) {

        }

        return {
            beforeLoad: beforeLoad,
            //beforeSubmit: beforeSubmit,
            //afterSubmit: afterSubmit
        };
    });