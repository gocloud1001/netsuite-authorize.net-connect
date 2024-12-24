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
 * @NApiVersion 2.1
 * @NScriptType plugintypeimpl
 * @NModuleScope Public
 *
 * @NAmdConfig ../config.json
 */
define(['exports', 'N/log', 'lodash', './AuthNet_lib'],
function(exports, log, _, SAC) {

    function testPaymentPresent(record){
        //log.debug('PI custbody_authnet_cim_token', record.getValue({ fieldId:'custbody_authnet_cim_token'}))
        //log.debug('PI custbody_authnet_cim_token_type', record.getValue({ fieldId:'custbody_authnet_cim_token_type'}))
        var i_tokenVal = 0
        if (!record.getValue({ fieldId:'custbody_authnet_cim_token_type'})){
            i_tokenVal = 1;
        }
        else
        {
            i_tokenVal = +record.getValue({ fieldId:'custbody_authnet_cim_token_type'})
        }
        return ( (record.getValue({ fieldId:'custbody_authnet_cim_token'}) && i_tokenVal !== 0));
    }

    //this is the test for a Sales Order
    exports.testSO = function (record) {
        SAC.pi_response.process = (
            !record.getValue({fieldId:'custbody_authnet_override'}) &&
            !record.getValue({ fieldId:'custbody_authnet_authcode'}) &&
            !record.getValue({fieldId:'custbody_authnet_refid'}) &&
            record.getValue({ fieldId:'custbody_authnet_use'})  //&&
            //testPaymentPresent(record)
            //(record.getValue({ fieldId:'orderstatus'}) !== 'A') //pending approval
        );
        if (SAC.pi_response.process){
            SAC.pi_response.process = testPaymentPresent(record);
        }
        log.audit('Plugin Validation - Sales Order', SAC.pi_response);
        return SAC.pi_response;
    };

    //this is a test for a Cash Sale FROM a Sales Order
    exports.testCSfromSO = function (record) {
        log.debug('Plugin Validation - Cash Sale from SO');
        if ((!record.getValue({fieldId:'custbody_authnet_override'}) &&
            record.getValue({fieldId: 'custbody_authnet_refid'}) &&
            record.getValue({fieldId: 'createdfrom'}) &&
            !_.isDate(record.getValue({fieldId: 'custbody_authnet_datetime'})))){
            SAC.pi_response.process = true;
            SAC.pi_response.type = 'doCapture';
        }
        else if (
            !record.getValue({fieldId: 'custbody_authnet_refid'}) &&
            record.getValue({fieldId: 'createdfrom'}) &&
            record.getValue({fieldId: 'custbody_authnet_cim_token'}) &&
            +record.getValue({fieldId: 'custbody_authnet_cim_token_type'}) === 2
        )
        {
            SAC.pi_response.process = true;
            SAC.pi_response.type = 'getAuthCapture';
        }
        else
        {
            SAC.pi_response.process = false;
        }
        //log.debug('Plugin Validation - !record.getValue({fieldId:\'custbody_authnet_override\'})', !record.getValue({fieldId:'custbody_authnet_override'}));
        //log.debug('Plugin Validation - record.getValue({fieldId: \'custbody_authnet_refid\'})', record.getValue({fieldId: 'custbody_authnet_refid'}));
        //log.debug('Plugin Validation - record.getValue({fieldId: \'createdfrom\'})', record.getValue({fieldId: 'createdfrom'}));
        //log.debug('Plugin Validation - ', !_.isDate(record.getValue({fieldId: 'custbody_authnet_datetime'})));

        log.audit('Plugin Validation - Cash Sale from SO', SAC.pi_response);
        return SAC.pi_response;
    };

    //this is a test for a standalone Cash Sale
    exports.testCSStandalone = function (record) {
        //log.debug('Plugin Validation - Cash Sale Standalone');
        SAC.pi_response.process = (
            !record.getValue({fieldId:'custbody_authnet_override'}) &&
            !record.getValue({fieldId: 'createdfrom'}) &&
            record.getValue('custbody_authnet_use') &&
            !record.getValue({fieldId: 'custbody_authnet_refid'}) &&
            testPaymentPresent(record)
        );
        log.audit('Plugin Validation - Cash Sale Standalone', SAC.pi_response);
        return SAC.pi_response;
    };

    //this is a test for a Customer Deposit
    exports.testCD = function (record) {
        SAC.pi_response.process = (
            !record.getValue({fieldId:'custbody_authnet_override'}) &&
            !record.getValue({ fieldId:'custbody_authnet_authcode'}) &&
            !record.getValue({fieldId:'custbody_authnet_refid'}) &&
            record.getValue({ fieldId:'custbody_authnet_use'})  &&
            testPaymentPresent(record)
        );
        log.audit('Plugin Validation - Customer Deposit', SAC.pi_response);
        return SAC.pi_response;
    };

    //this is a test for a Customer Payment
    exports.testCP = function (record) {
        log.debug('Plugin Validation - Customer Payment');
        SAC.pi_response.process = (
            !record.getValue({fieldId:'custbody_authnet_override'}) &&
            !record.getValue({fieldId:'custbody_authnet_authcode'}) &&
            !record.getValue({fieldId:'custbody_authnet_refid'}) &&
            record.getValue({fieldId:'custbody_authnet_use'})  &&
            testPaymentPresent(record)
        );
        log.debug('Plugin Validation - Customer Payment RESPONSE', SAC.pi_response);
        return SAC.pi_response;
    };

    //this is a test for a Cash Refund
    exports.testCashR = function (context) {
        log.debug('Plugin Validation - Cash Refund');
        SAC.pi_response.process = (
            (!context.newRecord.getValue({fieldId:'custbody_authnet_override'}) && context.newRecord.getValue({fieldId :'custbody_authnet_use'})) &&
            (
                context.type === context.UserEventType.CREATE ||
                (
                    (context.type === context.UserEventType.EDIT  && !context.newRecord.getValue('custbody_authnet_done'))
                )
            )
        );
        log.debug('Plugin Validation - Cash Refund RESPONSE', SAC.pi_response);
        return SAC.pi_response;
    };

    //this is a test for a Customer Refund
    exports.testCustR = function (context, o_config) {
        log.debug('Plugin Validation - Customer Refund');
        SAC.pi_response.process = (
            (
                context.type === context.UserEventType.CREATE && !context.newRecord.getValue('custbody_authnet_done') && !context.newRecord.getValue({fieldId:'custbody_authnet_override'}) &&
                (
                    (context.newRecord.getValue({ fieldId:'custbody_authnet_use'})  || _.includes([o_config.custrecord_an_paymentmethod.val, o_config.custrecord_an_paymentmethod_echeck.val], context.newRecord.getValue({fieldId: 'paymentmethod'})) )
                )
            )
            ||
            (
                context.type === context.UserEventType.EDIT && !context.newRecord.getValue('custbody_authnet_done') && !context.newRecord.getValue({fieldId:'custbody_authnet_override'}) &&
                (
                    (context.newRecord.getValue({ fieldId:'custbody_authnet_use'})  || _.includes([o_config.custrecord_an_paymentmethod.val, o_config.custrecord_an_paymentmethod_echeck.val], context.newRecord.getValue({fieldId: 'paymentmethod'})) )
                )
            )
        );
        log.debug('Plugin Validation - Customer Refund RESPONSE', SAC.pi_response);
        return SAC.pi_response;
    };
});