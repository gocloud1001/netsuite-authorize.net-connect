# netsuite-authorize.net-connect
NetSuite <> Authorize.Net Integration as a SDF project that runs completly inside NetSuite that is available under the [Apache License, Version 2.0 with Common Clause Version 1.0 license](https://www.gocloud1001.com/cloud1001-software-licence/ "Apache License, Version 2.0 with Common Clause Version 1.0 license") as part of the Cloud 1001, LLC Free & Open Suite Initiative.

## PRE-Installation
There is a PDF in the codebase that offers additional information about prerequisite components needed in your NetSuite account to support the installation. To enable thise you will need to navigate in your NetSuite account, while i nthe Administrator role, to Setup > Company > Enable Features >> SuiteCloud and enable the following:<br/>
- Custom Records<br/>
- Client SuiteScript<br/>
- Server SuiteScript<br/>
- SuiteFlow<br/>
- Token-based Authentication<br/>
- SuiteCloud Development Framework (SDF)<br/>

You also need to install the NetSuite provided “SuiteCloud Development Integration” (bundle id 245955) by navigating to Customization > Suitebundler > Search & Install Bundles and searching for 245955.  Validate the compnay name providing the result is "NetSuite Platform Solutions Group - SuiteCloud Development Integration" and then install the bundle.<br/>
After installing the above bundle, add the newly created "Developer" role to the user that is going to be installing the software AND use that role to issue the tokens for authentication that are required for the installation.

## Installation
Install and configure a supported IDE per the NetSuite SDF (SuiteCloud Development Framework) configuration to allow you to push a SDF project including all scripts, custom fields, custom records and other configuration objects into your environment.  While NetSuite offers differnt SuiteCloud Plugins for differnt IDE's, we STRONGLY reccomend the use of [WebStorm](https://www.jetbrains.com/webstorm/) which offers a free 30 day trial is is fare easier to use than the other options<br/>
Here are some resources for this step - it's easier than it sounds!<br/>
[SuiteCloud Development Framework: Installing the WebStorm IDE Plug-in for SDF](https://videohub.oracle.com/media/SuiteCloud+Development+FrameworkA+Installing+SuiteCloud+IDE+for+WebStorm/1_6pac06xz?ed=189)<br/>
[Super Helpful guide by Oracle](https://docs.oracle.com/cloud/latest/netsuitecs_gs/NSIDE/NSIDE.pdf "Super Helpful guide by Oracle")<br/>
ALSO - while logged into your instance of NetSuite - open Help and search for the following phrase - the results walk you through how to install the plugin for the IDE you have chosen: "SuiteCloud IDE Plug-in"<br/>
Once you have the SuiteCloud IDE Plug-in installed into your IDE (again we can't reccomend Webstorm over all the other options strongly enough), you can then configure the IDE Plugin to connect to NetSuite using the Account Managment in the Plugin and enter the tokens for your user and the instance number of your account.<br/>
Download the full directory structure into a NetSuite supported IDE (WebStorm) after configuring for connecting to you account (you can use git features for retrevingthe code - but unless you are going to be activily developing agaisnt the code, it's usually easier if yo uare not faliliar with git, to just download the hwole project)<br/>
Deploy the code to your account

## First Step after Installation or any update is applied
Type "SuiteAuthConnect Update Configuration" into the Global Search Box in NetSuite<br/>
Select "Page: SuiteAuthConnect Update Configuration"<br/>
On the single result - click Edit<br/>
Click "Save & Execute"<br/>
That's it...

## Configuration
All configuration of the connector is done from the Cloud 1001 menu in NetSuite, via SuiteAuthConnect > Configuration<br/>
All code is installed in SuiteScripts > openSuite > netsuite-authnet > sac<br/>
In that folder is a PDF that offers some older and a little outdated guidance on setup<br/>
One important step in that guide is the ability to obtain a free sandbox / test account from Authorize.Net - be sure to read that PDF (it's referenced in the PRE-Installation section as well)


## Questions
Cloud 1001, LLC provides this software under the above license and is the only consulting firm that you should pay to assit you with this software.  That's the point of the license - to make it free to anyone to obtain, use and modify - for their OWN purposes...  if another consulting group or individual is asking to be paid to in any way modify or assit with this software - they are in violation of the license.<br/>
Feel free to [reach out to us](https://www.gocloud1001.com "reach out to us") if you have any questions!
