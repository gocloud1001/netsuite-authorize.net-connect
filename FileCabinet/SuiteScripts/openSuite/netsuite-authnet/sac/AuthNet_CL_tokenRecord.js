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
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 * @NModuleScope Public
 *
 * @NAmdConfig ../config.json
 *
 */


define(['N/record', 'N/url', 'N/currentRecord', 'N/https', 'N/search', 'N/ui/dialog', 'lodash', 'moment'],
    function(record, url, currentRecord, https, search, dialog,_, moment) {
        function getParameterByName(name) {
            name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
            var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                results = regex.exec(location.search);
            return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
        }
        var a_bankFields = [
            //'custrecord_an_token_entity_email',
            //'custrecord_an_token_customer_type',
            'custpage_customertype',
            'custrecord_an_token_bank_routingnumber',
            'custrecord_an_token_bank_accountnumber',
            'custrecord_an_token_bank_nameonaccount',
            'custrecord_an_token_bank_bankname',
            'custpage_achtype',
            'custpage_banktype',
        ];
        var a_cardFields = [
            'custrecord_an_token_name_on_card',
            'custrecord_an_token_lastname_on_card',
            'custrecord_an_token_cardnumber',
            'custrecord_an_token_cardcode',
            'custrecord_an_token_expdate',
            'custrecord_an_token_entity_addr_number',
            'custrecord_an_token_entity_addr_city',
            'custrecord_an_token_entity_addr_state',
            'custrecord_an_token_entity_addr_zip',
            'custrecord_an_token_entity_addr_zipplus4',
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
                    if (fldName !== 'custrecord_an_token_bank_nameonaccount') {
                        context.currentRecord.setValue({fieldId: fldName, value: '', ignoreFieldChange: true});
                    }
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
                    if (!_.includes(['custrecord_an_token_entity_email', 'custrecord_an_token_customer_type', 'custpage_customertype', 'custrecord_an_token_bank_nameonaccount'], fldName)) {
                        context.currentRecord.setValue({fieldId: fldName, value: '', ignoreFieldChange: true});
                    }
                });
            }

        }
        function pageInit(scriptContext) {
            // do nothing for now...
            log.debug('pageInit', scriptContext);

            window.sessionStorage.setItem("config", scriptContext.currentRecord.getValue({fieldId: 'custpage_an_config'}));
            if (scriptContext.currentRecord.isNew && scriptContext.mode === 'create'){

                //scriptContext.currentRecord.setValue({fieldId:'custrecord_an_token_entity', value: getParameterByName('entity')})

                //fld_entity.isVisible = true;
                //fld_entity.isDisplay = true;
                log.debug('location.search',location.search)
                log.debug('getParameterByName(pi)',getParameterByName('pi'));
                if (getParameterByName('pi')){
                    scriptContext.currentRecord.setValue({fieldId: 'custrecord_an_token_entity', value: getParameterByName('pi')})
                }
                var s_o_config = window.sessionStorage.getItem("config");
                if (s_o_config)
                {
                    var o_config = JSON.parse(s_o_config);
                    if (o_config.mode === 'subsidiary'){
                        o_config = o_config.subs['subid' + scriptContext.currentRecord.getValue({fieldId: 'custrecord_an_token_subsidiary'})];
                        //moved below code all server side in the beforeLoad
                        /*if (window.opener)
                        {
                            if (window.opener.nlapiGetFieldValue('subsidiary')) {
                                console.log('Token PopUp!');
                                o_config = o_config.subs['subid' + window.opener.nlapiGetFieldValue('subsidiary')];
                            }
                        }
                        //this is for a token being entered directly off the custoemr to get the sub record filter
                        else if (getParameterByName('pi'))
                        {
                            console.log('Token Direct Pi!');
                            var o_custData = search.lookupFields({
                                type:'customer',
                                id : scriptContext.currentRecord.getValue({fieldId: 'custrecord_an_token_entity'}),
                                columns : ['subsidiary']
                            });
                            o_config = o_config.subs['subid'+o_custData.subsidiary[0].value];
                        }*/
                        if (o_config)
                        {
                            //scriptContext.currentRecord.setValue({fieldId: 'custrecord_an_token_subsidiary', value : o_config.subid});
                            scriptContext.currentRecord.setValue({fieldId: 'custrecord_an_token_gateway_sub', value : o_config.configid});
                        }
                    }
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
                    if (scriptContext.currentRecord.getValue({fieldId: 'custpage_customertype'}) === 'individual')
                    {
                        scriptContext.currentRecord.setValue({fieldId: 'custpage_achtype', value : 'PPD'});
                    }
                    else if (scriptContext.currentRecord.getValue({fieldId: 'custpage_customertype'}) === 'business')
                    {
                        scriptContext.currentRecord.setValue({fieldId: 'custpage_banktype', value : 'businessChecking'});
                        scriptContext.currentRecord.setValue({fieldId: 'custpage_achtype', value : 'CCD'});
                    }

                }
            }
            else if (scriptContext.fieldId === 'custrecord_an_token_expdate'){
                if (scriptContext.currentRecord.getValue({fieldId: 'custrecord_an_token_expdate'})){
                    var expDate = scriptContext.currentRecord.getValue({fieldId: 'custrecord_an_token_expdate'});
                    var m_expDate = moment(expDate, 'MMYY');
                    if (expDate.length === 0){
                        dialog.alert({title:'Missing Expiration Date', message: 'This is a required value.'});
                    } else if (expDate.length !== 4 || !(/^\d+$/.test(expDate)) ){
                        dialog.alert({title: 'Invalid Expiration Date', message: 'Format must be MMYY.  No other characters are needed or accepted.'});
                        scriptContext.currentRecord.setValue({fieldId: 'custrecord_an_token_expdate', value : ''});
                    } else if (m_expDate.isSameOrBefore(moment().subtract(1, 'month').endOf('month'))) {
                        dialog.alert({title: 'Invalid Expiration Date', message: moment(expDate, 'MMYY').format('MMMM YYYY') + ' has passed making the card expired.'});
                        scriptContext.currentRecord.setValue({fieldId: 'custrecord_an_token_expdate', value : ''});
                    }
                }

            }
            else if (scriptContext.fieldId === 'custrecord_an_token_cardcode')
            {
                var ccv = scriptContext.currentRecord.getValue({fieldId: 'custrecord_an_token_cardcode'});
                var b_goodcvv = ccv.length <= 4 && ccv.length > 2;
                if (!b_goodcvv) {
                    dialog.alert({title:'Invalid CVV Format', message: 'Value must be 3 or 4 numbers'});
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
                    var s_cardType = o_ccTypes[cardNum[0]];
                    if( _.isUndefined(o_ccTypes[cardNum[0]])){
                        s_cardType = ' unidentifiable credit card'
                    }
                    dialog.alert({title:'Invalid Card Number', message:'Recheck the entered information for the '+ s_cardType})
                }
            }
            else if (scriptContext.fieldId === 'custpage_customertype')
            {
                if (scriptContext.currentRecord.getValue({fieldId: 'custpage_customertype'}) === 'individual')
                {
                    scriptContext.currentRecord.setValue({fieldId: 'custpage_achtype', value : 'PPD', ignoreFieldChange:true});
                    scriptContext.currentRecord.setValue({fieldId: 'custpage_banktype', value : 'checking', ignoreFieldChange:true});
                }
                else if (scriptContext.currentRecord.getValue({fieldId: 'custpage_customertype'}) === 'business')
                {
                    scriptContext.currentRecord.setValue({fieldId: 'custpage_banktype', value : 'businessChecking', ignoreFieldChange:true});
                    scriptContext.currentRecord.setValue({fieldId: 'custpage_achtype', value : 'CCD', ignoreFieldChange:true});
                }
            }
            else if (scriptContext.fieldId === 'custpage_achtype' || scriptContext.fieldId === 'custpage_banktype')
            {
                if (scriptContext.currentRecord.getValue({fieldId: 'custpage_achtype'}) && scriptContext.currentRecord.getValue({fieldId: 'custpage_banktype'}))
                {
                    if (scriptContext.currentRecord.getValue({fieldId: 'custpage_achtype'}) === 'PPD' && scriptContext.currentRecord.getValue({fieldId: 'custpage_banktype'}) === 'businessChecking')
                    {
                        dialog.alert({title:'Bank Account and ACH Type Mismatch', message: 'Usually a PPD (Personal) ACH type is not associated with a Business Checking account. Please double check your selections before saving this record.'});
                    }
                    else if (scriptContext.currentRecord.getValue({fieldId: 'custpage_achtype'}) === 'CCD' && _.includes(['checking', 'savings'], scriptContext.currentRecord.getValue({fieldId: 'custpage_banktype'})))
                    {
                        dialog.alert({title:'Bank Account and ACH Type Mismatch', message: 'Usually a CCD (Company) ACH type is not associated with a personal checking or savings account. Please double check your selections before saving this record.'});
                    }
                }
            }
            else if (scriptContext.fieldId === 'custpage_an_token_subsidiary')
            {
                if (scriptContext.currentRecord.getValue({fieldId: 'custpage_an_token_subsidiary'}))
                {
                    //format is sub : gateway sub
                    var _subData = scriptContext.currentRecord.getValue({fieldId: 'custpage_an_token_subsidiary'}).split(":");
                    //console.log(_subData);
                    scriptContext.currentRecord.setValue({fieldId: 'custrecord_an_token_subsidiary', value:_subData[0]});
                    scriptContext.currentRecord.setValue({fieldId: 'custrecord_an_token_gateway_sub', value:_subData[1]});
                }

            }
        }


        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
        };

    });