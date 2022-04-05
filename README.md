# netsuite-authorize.net-connect
NetSuite <> Authorize.Net Integration as a SDF project that runs completely inside NetSuite that is available under the [Apache License, Version 2.0 with Common Clause Version 1.0 license](https://www.gocloud1001.com/cloud1001-software-licence/ "Apache License, Version 2.0 with Common Clause Version 1.0 license") as part of the Cloud 1001, LLC Free & Open Suite Initiative.

## READ THIS BEFORE PROCEEDING
Although [our FAQ's](https://www.gocloud1001.com/suiteauthconnect-faq/) make this as clear as we can make it - it needs to be reiterated : **THIS SOLUTION DOES NOT USE THE NetSuite Payment Gateway Plug-In**, because it is not allowed to. This solution offers an approximation of credit card payment processing following the native NetSuite flow via the Authorize.Net payment gateway. While it uses only native NetSuite API calls inside of NetSuite - it is NOT a "NetSuite Payment Gateway" - and because of this there are some inherent limitations to it's functionality.
Here's a checklist and grades of things it does and does not do:
 - [**A+**] Allows for processing of authorizations or authorizations+captures created in an *external webstore like Magento, Shopify, WooCommerce, BigCommerce, etc* inside of NetSuite
 - [**A+**] Allows for direct processing of authorizations or authorizations+captures inside of NetSuite on the appropriate transaction type following native card processing logic
 - [**A+**] Storage of card data using Authorize.Net CIM for PCI complaint tokens and no raw card data
 - [**F**] SuiteCommerce will not work with this solution because it is not a Gateway Plugin
 - [**D-**] Customer Center "self pay" has not been tested, may or may not work, likely will not
 - [**F**] The new(ish) "Pay Now" link functionality in NetSuite is not supported as that uses NetSuite Payment Instruments which is part of their Payment Gateway, which this is not part of

## PRE-Installation
There is a PDF in the codebase that offers additional information about prerequisite components needed in your NetSuite account to support the installation. To enable these you will need to navigate in your NetSuite account, while in the Administrator role, to Setup > Company > Enable Features >> SuiteCloud and enable the following:<br/>
- Custom Records<br/>
- Client SuiteScript<br/>
- Server SuiteScript<br/>
- SuiteFlow<br/>
- Token-based Authentication<br/>
- SuiteCloud Development Framework (SDF)<br/>

You also need to install the NetSuite provided “SuiteCloud Development Integration” (bundle id 245955) by navigating to Customization > Suitebundler > Search & Install Bundles and searching for 245955.  Validate the company name providing the result is "NetSuite Platform Solutions Group - SuiteCloud Development Integration" and then install the bundle.<br/>
After installing the above bundle, add the newly created "Developer" role to the user that is going to be installing the software AND use that role to issue the tokens for authentication that are required for the installation.

## Installation
Install and configure a supported IDE per the NetSuite SDF (SuiteCloud Development Framework) configuration to allow you to push a SDF project including all scripts, custom fields, custom records and other configuration objects into your environment.  While NetSuite offers different SuiteCloud Plugins for different IDE's, we STRONGLY recommend the use of [WebStorm](https://www.jetbrains.com/webstorm/) which offers a free 30 day trial is is fare easier to use than the other options<br/>
Here are some resources for this step - it's easier than it sounds!<br/>
[SuiteCloud Development Framework: Installing the WebStorm IDE Plug-in for SDF](https://videohub.oracle.com/media/SuiteCloud+Development+FrameworkA+Installing+SuiteCloud+IDE+for+WebStorm/1_6pac06xz?ed=189)<br/>
[Super Helpful guide by Oracle](https://docs.oracle.com/cloud/latest/netsuitecs_gs/NSIDE/NSIDE.pdf "Super Helpful guide by Oracle")<br/>
ALSO - while logged into your instance of NetSuite - open Help and search for the following phrase - the results walk you through how to install the plugin for the IDE you have chosen: "SuiteCloud IDE Plug-in"<br/>
Once you have the SuiteCloud IDE Plug-in installed into your IDE (again we can't recommend Webstorm over all the other options strongly enough), you can then configure the IDE Plugin to connect to NetSuite using the Account Management in the Plugin and enter the tokens for your user and the instance number of your account.<br/>
Download the full directory structure into a NetSuite supported IDE (WebStorm) after configuring for connecting to you account (you can use git features for retrieving the code - but unless you are going to be actively developing against the code, it's usually easier if you are not familiar with git, to just download the whole project)<br/>
Deploy the code to your account

## First Step after Installation OR after ANY update is applied

 1. Type "SuiteAuthConnect Update Configuration" into the Global Search Box in NetSuite<br/> 
 3. Select "Page: SuiteAuthConnect Update Configuration"<br/> 
 4. On the single result - click Edit<br/> 
 5. Click "Save & Execute"<br/>
 6. That's it...

## Configuration
All configuration of the connector is done from the Cloud 1001 menu in NetSuite, via SuiteAuthConnect > Configuration<br/>
All code is installed in SuiteScripts > openSuite > netsuite-authnet > sac<br/>
In that folder is a PDF that offers some older and a little outdated guidance on setup<br/>
One important step in that guide is the ability to obtain a free sandbox / test account from Authorize.Net - be sure to read that PDF (it's referenced in the PRE-Installation section as well)

## To Uninstall
Really wish we had a better answer here - but the folks at Oracle do not provide an "uninstall" for a SDF Configuration project like they do "bundles" - so to uninstall this you need to manually find all Custom Fields, Custom Records, Custom Lists, Scripts / Script Deployments with SuiteAuth or something like that in the name and manually delete them from your system.  Then you can navigate to SuiteScripts in the file cabinet and delete the directory openSuite (if you have no other openSuite projects installed) or SuiteScripts > openSuite > sac if just SuiteAuthConnect is installed.

## Questions
Cloud 1001, LLC provides this software under the above license and is the only consulting firm that you should pay to assist you with this software.  That's the point of the license - to make it free to anyone to obtain, use and modify - for their OWN purposes...  if another consulting group or individual is asking to be paid to in any way modify or assist with this software - they are in violation of the license.<br/>
Feel free to [reach out to us](https://www.gocloud1001.com "reach out to us") if you have any questions!

## Roadmap
3.1 is coming very soon which includes eCheck support (ACH) using Authorize.net, default payments by customer and sets the stage for "pay by link" logic to let people pay their invoices directly!

    This readme is made pretty by https://stackedit.io
