---
title: "Policy Studio quick reference"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_poldev/general_project/index.html
scrapedAt: 2026-08-21T20:44:09.103Z
---

5 minute read

## Create a new project

To create a new project in Policy Studio, select File > New Project from the main menu, or click New Project on the welcome page. Follow the steps in the New Project wizard.

For more details, see Create a project.

## Open an existing project

To open an existing project in Policy Studio, select File > Open Project from the main menu, or click Open Project on the welcome page, and enter the project details in the dialog. Alternatively, click a link to the existing project in the Recent Projects pane on the welcome page.

When you select File > Open Project or click Open Project on the welcome page, you can configure the following connection settings in the Open project window:

Location: Enter or browse to the full path to the project in the file system (for example, C:\Users\john\apiprojects\my_test_project). You can select from the connection history of existing projects in the list.

Project Name: If a valid project location is selected, Policy Studio completes this field with the project name configured in the .project file in the specified project Location.

Passphrase: Enter the encryption passphrase if one has been configured.

## Save changes to a project

When a project is loaded in Policy Studio, you can select File > Save from the main menu to save the changes to the current configuration editor.

Alternatively, select File > Save All to save the changes to all open unsaved configuration editors.

## Deploy changes to a project

When a project is loaded in Policy Studio, you can select Tasks > Deploy from the main menu to deploy saved changes to a running API Gateway instance at any time. Alternatively, click the Deploy button in the toolbar.

For more details, see Manage API Gateway deployments.

## Add an API to a project

When a project is loaded in Policy Studio, you can select Tasks > Add REST API from the main menu to add an API to the project.

For more details, see Develop REST APIs in Policy Studio.

## Virtualize a web service

When a project is loaded in Policy Studio, you can select Tasks > Virtualize a Service from the main menu to use the API Gateway to virtualize a web service.

For more details, see Register and secure web services.

## Change the project passphrase

You can use the projchangepass command to change the encryption passphrase for a Policy Studio project. For more information on projchangepass, see Packaging and deployment tools.

##### Note

For more details on configuring encryption passphrases, see the API Gateway Administrator Guide.

## Export configuration packages

When a project is loaded in Policy Studio, you call select File > Export to save the project as a configuration package. Select one of the following from the menu:

- Deployment package: Saves the project as an XML .fed file or YAML .tar.gz file that contains all API Gateway configuration. This includes policies, listeners, external connections, users, certificates, and environment settings.

- Policy package: Saves the project as a .pol file that contains policies, listeners, external connections, and environment settings. This contains just the fields environmentalized, and not their values.

- Environment package: Saves the project as a .env file that contains users, certificates, and environment settings. This contains a list of environmentalized fields with environment-specific values.

When you have saved a configuration package, you can use it to create a Policy Studio project in another environment.

## Import configuration into a project

When a project is loaded in Policy Studio, you can select File > Import > Configuration Fragment from the main menu to import configuration into the project. This feature enables you to import XML or YAML-based configuration previously exported from Policy Studio.

You can also select File > Import > Custom filters to import custom filters to be added to the Policy Studio filter palette.

## Manage multiple projects

You can work with multiple projects in Policy Studio. When a project is loaded in Policy Studio, you can click the Show List icon (») in the toolbar to display a list of currently open views (for example, other open projects and the welcome page). Select an item in the list to switch between views. The toolbar also displays the number of available views beside the Show List icon in the toolbar.

## Close a project

To close the project currently open in Policy Studio, select File > Close Project from the main menu. Alternatively, click the X icon next to the project name in the toolbar.

## Unlock a server connection

You can also unlock an existing connection to a server. This is for emergency use if you have changed configuration, and this results in you being locked out from the Management Services on port 8090. In this case, you have incorrectly configured the authentication filter in the Protect Management Interfaces policy.

For example, if you created and deployed an LDAP connection without specifying the correct associated user accounts, and are now unable to connect to the Admin Node Manager.

To unlock a server connection, perform the following steps:

1. Download all the files in the server’s conf/fed directory to the machine on which Policy Studio is installed.

2. Start Policy Studio.

3. Create a new project from existing configuration based on the conf/fed directory that you downloaded from the server in step 1.

4. Change the configuration details as required (for example, specify the correct user account details for the LDAP connection under the Environment Configuration > External Connections node).

5. Upload the files back to the server’s conf/fed directory.

6. Restart the Admin Node Manager.

For more details on Management Services, see Management services.

##### On this page

- Create a new project

- Open an existing project

- Save changes to a project

- Deploy changes to a project

- Add an API to a project

- Virtualize a web service

- Change the project passphrase

- Export configuration packages

- Import configuration into a project

- Manage multiple projects

- Close a project

- Unlock a server connection
