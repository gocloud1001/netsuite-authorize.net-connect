/**
 * @exports XXX
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
 * IN NO EVENT SHALL CLOUD 1001, LLC, LLC BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF CLOUD 1001, LLC HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * CLOUD 1001, LLC SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE AND ACCOMPANYING DOCUMENTATION, IF ANY, PROVIDED HEREUNDER IS PROVIDED "AS IS". CLOUD 1001, LLC HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
 *
 * @author Andy Prior <andy@gocloud1001.com>
 *
 * @NAmdConfig /SuiteScripts/openSuite/netsuite-authnet/config.json
 *
 * */

define(["require", "exports", 'N/runtime', 'N/file', 'N/crypto', 'N/format', 'N/encode', 'N/url', 'N/config', 'N/record', 'lodash', 'SuiteScripts/openSuite/netsuite-authnet/sac/AuthNet_lib'],
    function (require, exports, runtime, file, crypto, format, encode, url, config, record, _,  authNet) {



        exports.crypto = {
            encrypt : (text) => {
                const sKey = crypto.createSecretKey({
                    secret: 'custsecret_authnet_payment_link',
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
            decrypt : (cipherPayload) => {
                const sKey = crypto.createSecretKey({
                    secret: 'custsecret_authnet_payment_link',
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
                        asNumber : +o_invoiceRec.getValue({fieldId:'amountremaining'}),
                        asCurrency : format.format({value:+o_invoiceRec.getValue({fieldId:'amountremaining'}), type: format.Type.CURRENCY})
                    };
                    return o_totalDue;
                }
            }
        exports.authNet = {
            getCache : (o_record) => {
                let o_config2 = authNet.getConfigFromCache();
                //now switch the object to the correct sub config!
                if (o_config2.mode === 'subsidiary'){
                    o_config2 = authNet.getSubConfig(o_record.getValue({fieldId : 'subsidiary'}), o_config2);
                    //log.debug('subsidiary o_config2', o_config2);
                }

                let logoFileId;
                if (o_config2.custrecord_an_click2pay_logo.val)
                {
                    logoFileId = o_config2.custrecord_an_click2pay_logo.val;
                }
                else
                {
                    if (o_config2.isSubConfig)
                    {
                        let _subRec = record.load({
                            type:'subsidiary',
                            id : o_record.getValue({fieldId : 'subsidiary'}),
                        });
                        logoFileId = _subRec.getValue({fieldId:'logo'});
                        log.audit('Multi-sub config', 'Getting Subsidiary LogoID '+logoFileId);
                    }
                    //if the sub has no logo, use the whole company logo
                    if (!logoFileId)
                    {
                        let o_company = config.load({
                            type: config.Type.COMPANY_INFORMATION
                        });
                        logoFileId = o_company.getValue({fieldId: 'formlogo'});
                        log.audit('No Logo ID', 'Defaulting to company logoIC '+logoFileId);
                    }
                }
                let logoFile = file.load({id:logoFileId});
                o_config2.logofile = logoFile.getContents();
                return o_config2;
            }
        }
    });