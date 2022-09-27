/**
 *  * @copyright Copyright ©2020. Cloud 1001, LLC.
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
 * @author Andy Prior <andy@gocloud1001.com>
 *
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/url', 'N/currentRecord'],

    function(record, url, currentRecord) {

        function batchLookup(context){
            console.log(context.fieldId)
            if (context.fieldId === 'lookup_batch'){
                if (context.currentRecord.getValue({fieldId:'lookup_batch'})){
                    window.open('/app/common/search/searchresults.nl?searchtype=Transaction&CUSTBODY_AUTHNET_BATCHID='+context.currentRecord.getValue({fieldId:'lookup_batch'})+'&style=NORMAL&CUSTBODY_AUTHNET_BATCHIDtype=IS&CUSTBODY_AUTHNET_BATCHIDfooterfilter=T&report=&grid=&searchid=customsearch_ans_batch_settlement_detail&dle=T&sortcol=Transction_ORDTYPE9_raw&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&twbx=F', 'search');
                    context.currentRecord.setValue({fieldId:'lookup_batch', value: '', ignoreFieldChange:true});
                }
            }
        }

        function pageInit(scriptContext){
            console.log('?')
        }


        return {
            fieldChanged: batchLookup,
            //pageInit : pageInit,
            //saveRecord : saveRecord
        };

    });
