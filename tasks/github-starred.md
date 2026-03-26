# Github Starred Collections



## Task 1: Gather Github Starred Repositories

What to do:
1. gathering all the github starred repositories for a given github user name
2. save them into a database
3. provide a web page to view all the starred repositories for a given github user name
4. star num filter which is a between filter,language filter and tag filter should be included


What to tech stack to use:
1. use golang pocket base as backend service 
2. use typescript ,nextjs, shadcn-ui,vite to build the web page
3. github starred repo should hava following attribute:
    1. star num
    2. repo name
    3. repo description
    4. repo language
    5. repo fork num
    6. repo tags/labels


For examples:
1. github user name is qdriven
2. fetch all the starred repo then save to local database in a scheduled manner
3. And also add github action to run this job to save the data into a json file, then commit it overtime.


Verify Scenarios:
1. could fetch github starred repo for github user: qdriven
2. could save the fetched github starred repo into local database
3. could provide a web page to view all the starred repositories for a given github user name
4. could filter the starred repositories by star num, language and tag filter