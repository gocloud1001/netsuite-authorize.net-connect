
/**
 * Module Description...
 *
 * @copyright 2021 Cloud 1001, LLC
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
 * @author Cloud 1001, LLC <suiteauthconnect@gocloud1001.com>
 *
 * @NApiVersion 2.0
 * @NModuleScope Public
 * @NScriptType MapReduceScript
 *
 * @NAmdConfig ../config.json
 */
define(['exports', 'N/record', 'N/search', 'N/format', 'lodash', './AuthNet_lib'],
function (exports, record, search, format, _, authNet) {
    exports.getInputData = function () {
        log.audit('starting the getInputs for Authorize.Net Settlment', 'mapping and reducing shall commence!');
        var a_transactionsToBeSettled = [];
        //var licenceValidation = authNet.validateLicence2();

        var settlement_search = search.load({
            id: 'customsearch_ans_daily_settlement'
        });

        var results_settlement_search = settlement_search.run();
        var a_columns = [];
        results_settlement_search.columns.forEach(function (col) {
            a_columns.push(col);
        });
        var i_range = 1000, b_hasMore = true;
        while (b_hasMore) {
            var i_resultCount = 0;
            var results = results_settlement_search.getRange({
                start: (i_range - 1000), //Index number of the first result to return, inclusive
                end: i_range //Index number of the last result to return, exclusive
            });
            //log.debug('results', results)
            _.forEach(results, function (val) {
                //log.debug('val', val)
                var obj = {
                    rectype: val.recordType,
                    id: +val.id
                };
                _.forEach(a_columns, function (col) {
                    var fieldId = (col.join) ? col.join + '.' + col.name : col.name;
                    obj[fieldId] = {
                        val: val.getValue(col),
                        txt: val.getText(col)
                    }
                });
                a_transactionsToBeSettled.push(obj);
                i_resultCount++;
                return true;
            });
            log.audit('in the process of counting in range ' + (i_range - 1000) + ' to ' + i_range, i_resultCount);
            b_hasMore = i_resultCount === 1000;
            i_range += 1000;
        }
        log.audit('Raw Settlment record count is : ' + _.size(a_transactionsToBeSettled), 'Now commencing with the updates!');

        var runRecord = record.create({
            type: 'customrecord_authnet_settlement'
        });
        var now = new Date();
        if (a_transactionsToBeSettled.length > 0) {
            runRecord.setValue({fieldId: 'custrecord_ans_status', value: 'Processing'});
            runRecord.setValue({fieldId: 'custrecord_ans_num_to_settle', value: a_transactionsToBeSettled.length});
            now.setSeconds(now.getSeconds() + ((a_transactionsToBeSettled.length * 4) * 1)); //num records * 4 sec each * 1 record
            runRecord.setValue({
                fieldId: 'custrecord_ans_estimated_time', value: now
            });
        } else {
            runRecord.setValue({fieldId: 'custrecord_ans_status', value: 'Nothing To Process - no records found'});
            runRecord.setValue({fieldId: 'custrecord_ans_num_to_settle', value: 0});
            runRecord.setValue({fieldId: 'custrecord_ans_estimated_time', value: now});
            runRecord.setValue({fieldId: 'custrecord_ans_actual_time', value: now});
        }
        runRecord.save();

        return a_transactionsToBeSettled;
    };

    exports.map = function (context) {
        var recToChange = JSON.parse(context.value);
        authNet.homeSysLog('recToChange',recToChange);
        var txn;
        try {
            txn = record.load({
                type: recToChange.rectype,
                id: recToChange.id
            });
            authNet.doSettlement(txn);
            log.audit('settlment action updated on '+recToChange.type.txt+', id '+ recToChange.id)
        } catch (ex){
            log.error(ex.name, ex.message);
        }

    };

    exports.summarize = function(summary) {
        var type = summary.toString();

        var o_updates = {
            custrecord_ans_status : 'Completed',
            custrecord_ans_isprocessed : true,
            custrecord_ans_summary_units : summary.usage,
            custrecord_ans_summary_input_time : summary.inputSummary.seconds,
            custrecord_ans_summary_map_time : summary.mapSummary.seconds,
            custrecord_ans_summary_total_time : (+summary.seconds / 60).toFixed(1),
            custrecord_ans_actual_time : format.format({
                value: new Date(),
                type: format.Type.DATETIME
            })
        };
        record.submitFields({
            type : 'customrecord_authnet_settlement',
            id: authNet.getSettlmentRec().id,
            values : o_updates
        });

        log.audit(type + ' Usage Consumed', summary.usage);
        log.audit(type + ' Number of Queues', summary.concurrency);
        log.audit(type + ' Number of Yields', summary.yields);
        log.audit('Input Time Elapsed', summary.inputSummary.seconds);
        log.audit('Map Time Elapsed', summary.mapSummary.seconds);
        log.audit(type + ' Total seconds elapsed', summary.seconds);
        log.audit('DONE','All done - everything should be updated');
    }
});