prpr
====
The project aims to **implement one component** of a decentralized architecture for online streaming services.  
 
Big Picture
----
In our system, there is an **agent** on each client for looking and caching the requested video segments for the playback on that client.

The **agent** knows where to retrieve a requested video segment by querying to the **location servers**.

The **agent** will store consumed video segments in its storage of each client, and then inform the location servers so that the other nearby agents can thus retrieve the video segments from this agent.

The **location server** is a component responsible for recoding resources maps.  
 
Finally, there is a **interceptor** on each client for manipulating all the video requests from their playbacks. 

Implementation
-----
The agent is implemented as an **HTTP proxy/cache server** in a **packaged app** for Google Chrome.  

Current State
-----
Support YouTube.com with HTML5 playback on Google Chrome.
  
* support different video qualities. (also on-the-fly)  
* support video segments retrieving from multiple sources (agents).  

