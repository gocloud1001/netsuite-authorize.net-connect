/**
 * @exports XXX
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
 * IN NO EVENT SHALL CLOUD 1001, LLC, LLC BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF CLOUD 1001, LLC HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * CLOUD 1001, LLC SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE AND ACCOMPANYING DOCUMENTATION, IF ANY, PROVIDED HEREUNDER IS PROVIDED "AS IS". CLOUD 1001, LLC HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
 *
 * @author Andy Prior <andy@gocloud1001.com>
 *
 * */

define(["require", "exports", 'N/runtime', 'N/search', 'N/crypto', 'N/format', 'N/encode', 'N/url', '../../lib/lodash.min'],
    function (require, exports, runtime, search, crypto, format, encode, url, _) {



        exports.crypto = {
            encrypt : (text, secret) => {
                const sKey = crypto.createSecretKey({
                    secret: secret,
                    encoding: encode.Encoding.UTF_8,
                });

                const myCipher = crypto.createCipher({
                    algorithm: crypto.EncryptionAlg.AES,
                    key: sKey,
                    padding: crypto.Padding.PKCS5Padding,
                });

                myCipher.update({
                    input: text,
                    inputEncoding: encode.Encoding.UTF_8,
                    outputEncoding: encode.Encoding.BASE_64,
                });

                const cipherPayload = myCipher.final({
                    outputEncoding: encode.Encoding.BASE_64,
                });
                return cipherPayload;
            },
            decrypt : (cipherPayload, secret) => {
                const sKey = crypto.createSecretKey({
                    secret: secret,
                    encoding: encode.Encoding.UTF_8,
                });

                const myDecipher = crypto.createDecipher({
                    algorithm: crypto.EncryptionAlg.AES,
                    key: sKey,
                    padding: crypto.Padding.PKCS5Padding,
                    iv: cipherPayload.iv,
                });

                myDecipher.update({
                    input: cipherPayload.ciphertext,
                    inputEncoding: encode.Encoding.BASE_64,
                });

                return myDecipher.final();
            },
            encode64 : (text) =>
            {
                return encode.convert({
                    string : text,
                    inputEncoding: encode.Encoding.UTF_8,
                    outputEncoding: encode.Encoding.BASE_64_URL_SAFE
                })
            },
            decode64 : (text) =>
            {
                return encode.convert({
                    string: text,
                    inputEncoding: encode.Encoding.BASE_64_URL_SAFE,
                    outputEncoding: encode.Encoding.UTF_8
                })
            }
        };
        exports.paymentlink =
            {
                serviceUrl : () =>
                {
                    return url.resolveScript({
                        scriptId: 'customscript_sac_sl21_click2pay_svc',
                        deploymentId: 'customdeploy_sac_sl21_click2pay_svc',
                        returnExternalUrl: true
                    });
                },
                invoiceAmountDue : (o_invoiceRec) =>
                {
                    let o_totalDue = {
                        asNumber : +o_invoiceRec.getValue('amountremaining'),
                        asCurrency : format.format({value:+o_invoiceRec.getValue('amountremaining'), type: format.Type.CURRENCY})
                    };
                    /*search.create({
                        type:'transaction',
                        filters : [
                            ['appliedtotransaction', 'anyof', [recId]],
                            "AND",
                            ['mainline', 'is', true]
                        ],
                        columns :
                            [
                                'type',
                                'amount',
                                'amountremaining',
                                'tranid',
                                'statusref',
                            ]
                    }).run().each(function (result) {
                        //log.debug('result: '+context.request.clientIpAddress, result);
                        o_totalDue.asNumber += +result.getValue('amountremaining');
                        return true;
                    });
                    //make it look human
                    o_totalDue.asCurrency = format.format({value:o_totalDue.asNumber, type: format.Type.CURRENCY});
                    */
                    return o_totalDue;
                }
            }
    });