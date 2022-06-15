/**
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
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 * @NModuleScope Public
 *
 * @NAmdConfig ../config.json
 *
 */


define(['N/record', 'N/url', 'N/currentRecord', 'N/https', 'lodash', 'moment'],
    function(record, url, currentRecord, https, _, moment) {
        function getParameterByName(name) {
            name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
            var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                results = regex.exec(location.search);
            return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
        }
        var a_bankFields = [
            'custrecord_an_token_entity_email',
            'custrecord_an_token_customer_type',
            'custrecord_an_token_bank_routingnumber',
            'custrecord_an_token_bank_accountnumber',
            'custrecord_an_token_bank_nameonaccount',
            'custrecord_an_token_bank_bankname',
            'custpage_achtype',
            'custpage_banktype',
        ];
        var a_cardFields = [
            'custrecord_an_token_cardnumber',
            'custrecord_an_token_cardcode',
            'custrecord_an_token_expdate',
        ];
        var a_completedField = [
            'custrecord_an_token_last4',
            'custrecord_an_token_customerid',
            'custrecord_an_token_token',
            'custrecord_an_token_type',
        ];
        function showBankFields(context, show){
            _.forEach(a_bankFields, function(fldName){
                //og.debug(fldName)
                try {
                    var _fld = context.currentRecord.getField({
                        fieldId: fldName
                    });
                    _fld.isVisible = show;
                    _fld.isDisplay = show;
                }
                catch(e){
                    //some fields for bank are dynamic based off context
                }
            });
            if (show){
                //if we are showing bank - clear all card data
                _.forEach(a_cardFields, function(fldName) {
                    context.currentRecord.setValue({fieldId: fldName, value :'', ignoreFieldChange:true});
                });
            }
        }
        function showCardFields(context, show){
            _.forEach(a_cardFields, function(fldName){
                //log.debug(fldName)
                try {

                    var _fld = context.currentRecord.getField({
                        fieldId: fldName
                    });
                    _fld.isVisible = show;
                    _fld.isDisplay = show;
                    _fld.isDisabled = !show;
                }
                catch (e)
                {
                    //might not work
                }
            });
            if (show){
                //if we are showing card - clear all bank data
                _.forEach(a_bankFields, function(fldName) {
                    if (!_.includes(['custrecord_an_token_entity_email', 'custrecord_an_token_customer_type'], fldName)) {
                        context.currentRecord.setValue({fieldId: fldName, value: '', ignoreFieldChange: true});
                    }
                });
            }

        }
        function pageInit(scriptContext) {
            // do nothing for now...
            log.debug('pageInit', scriptContext);

            if (scriptContext.currentRecord.isNew && scriptContext.mode === 'create'){

                //scriptContext.currentRecord.setValue({fieldId:'custrecord_an_token_entity', value: getParameterByName('entity')})

                //fld_entity.isVisible = true;
                //fld_entity.isDisplay = true;
                log.debug('location.search',location.search)
                log.debug('getParameterByName(pi)',getParameterByName('pi'));
                if (getParameterByName('pi')){
                    scriptContext.currentRecord.setValue({fieldId: 'custrecord_an_token_entity', value: getParameterByName('pi')})
                }
                showBankFields(scriptContext,false);
                showCardFields(scriptContext,true);
                _.forEach(a_completedField, function(fldName){
                    var _fld = scriptContext.currentRecord.getField({
                        fieldId: fldName
                    });
                    _fld.isVisible = false;
                    _fld.isDisplay = false;
                });


            }
        }

        function fieldChanged(scriptContext){
            if (scriptContext.fieldId === 'custrecord_an_token_paymenttype'){
                //1 is card 2 is eCheck
                var i_paymentType = +scriptContext.currentRecord.getValue({fieldId: 'custrecord_an_token_paymenttype'});
                if (i_paymentType === 1){
                    //hide all bank fields
                    showBankFields(scriptContext,false);
                    showCardFields(scriptContext,true);
                }
                else if (i_paymentType === 2)
                {
                    //show all bank fields
                    showBankFields(scriptContext,true);
                    showCardFields(scriptContext,false);

                }
            }
            else if (scriptContext.fieldId === 'custrecord_an_token_expdate'){
                if (scriptContext.currentRecord.getValue({fieldId: 'custrecord_an_token_expdate'})){
                    var expDate = scriptContext.currentRecord.getValue({fieldId: 'custrecord_an_token_expdate'});
                    var m_expDate = moment(expDate);
                    if (expDate.length === 0){
                        alert( 'Missing Expiration Date');
                    } else if (expDate.length !== 4){
                        alert( 'Invalid Expiration Date - format must be MMYY');
                    } else if (m_expDate.isSameOrAfter(moment().endOf('month'))) {
                        alert( 'Invalid Expiration Date - ' + moment(expDate, 'MMYY').format('MMMM YYYY') + ' has passed');
                    }
                }

            }
            else if (scriptContext.fieldId === 'custrecord_an_token_cardcode')
            {
                var ccv = scriptContext.currentRecord.getValue({fieldId: 'custrecord_an_token_cardcode'});
                var b_goodcvv = ccv.length <= 4 && ccv.length > 2;
                if (!b_goodcvv) {
                    alert(' Invalid CVV Format - must be 3 or 4 numbers');
                }
            }
            else if ((scriptContext.fieldId === 'custrecord_an_token_cardnumber'))
            {
                var o_ccTypes = {
                    3 : 'Amex',
                    4 : 'Visa',
                    5 : 'Master Card',
                    6 : 'Discover'
                };
                var cardNum = scriptContext.currentRecord.getValue({fieldId: 'custrecord_an_token_cardnumber'});
                var b_goodCard;
                if ((_.includes([4, 5, 6], +cardNum[0]) && cardNum.length === 16)) {
                    b_goodCard = true;
                } else if (+cardNum[0] === 3 && cardNum.length >= 15){
                    b_goodCard = true;
                } else {
                    b_goodCard = false;
                }
                if (!b_goodCard)
                {
                    alert('Invalid Card Number - recheck this ' + o_ccTypes[cardNum[0]]);
                }
            }
        }


        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
        };

    });