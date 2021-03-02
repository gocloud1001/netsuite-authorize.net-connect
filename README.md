# netsuite-authorize.net-connect
NetSuite <> Authorize.Net Integration as a SDF project that runs completly inside NetSuite that is available under the [Apache License, Version 2.0 with Common Clause Version 1.0 license](https://www.gocloud1001.com/cloud1001-software-licence/ "Apache License, Version 2.0 with Common Clause Version 1.0 license") as part of the Cloud 1001, LLC Free & Open Suite Initiative.

## PRE-Installation
There is a PDF in the codebase that offers additional information about prerequisite components needed in your NetSuite account to support the installation. <br/>
Custom Records<br/>
Client SuiteScript<br/>
Server SuiteScript<br/>
SuiteFlow<br/>
Token-based Authentication<br/>
SuiteCloud Development Framework (SDF)<br/>
You also need to install the NetSuite provided “SuiteCloud Development Integration” (bundle id 245955)

## Installation
Install and configure a supported IDE per the NetSuite SDF (SuiteCloud Development Framework) configuration to allow you to push a SDF project including all scripts, custom fields, custom records and other configuration objects into your environment.<br/>
Here are some resources for this step - it's easier than it sounds!<br/>
[Google Links with YouTube](https://www.google.com/search?q=how+to+configure+eclipse+for+sdf "Google Links with YouTube")<br/>
[Super Helpful guide by Oracle](https://docs.oracle.com/cloud/latest/netsuitecs_gs/NSIDE/NSIDE.pdf "Super Helpful guide by Oracle")<br/>
Downloading the full directory structure into a NetSuite supported IDE (Eclipse or WebStorm) after configuring for connecting to you account<br/>
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
