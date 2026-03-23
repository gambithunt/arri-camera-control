# Camera Access Protocol (CAP) Version 1.12

for

ALEXA SXT/LF/65 2.0, ALEXA Mini/Mini LF & AMIRA 7.3. ALEXA 35 1.3.0

SPECIFICATION

Date: June 17, 2024 

## Camera Access Protocol CAP 1.12

### New

| Date       | Change Note                  | Bug fixes | Critical changes                                                                 | Author   |
|------------|------------------------------|-----------|----------------------------------------------------------------------------------|----------|
| 2024-06-14 | Removed DRAFT state          | /         | /                                                                                | Hansen  |
| 2024-06-03 | User Button Functions        | /         | - Add UB Functions for RET IN 1/2<br>- Add UB Functions for Intercom PROD MIC and ENG MIC | Brauner |
| 2024-05-29 | Added additional video parameters | /         | - Add Variable "Lift Master"<br>- Add Variable "Lift RGB"<br>- Add Variable "White RGB" | Schorp  |
| 2024-05-06 | Added Multicam Intercom State | /         | - Add variable "Multicam Intercom Selector"                                      | Kadlez  |
| 2024-04-24 | Added Timecode source variables | /         | - Add Variable "LTC Source"<br>- Add Variable "TC init mode GUI"                 | Hinz    |
| 2024-04-08 | Added Tally Trigger variable | /         | - Add Variable "Tally Trigger"                                                   | Hinz    |
| 2024-03-26 | Added Tally brightness variables | /         | - Add Variable "Tally Light Brightness"<br>- Add Variable "Tally ID Brightness"  | Hinz    |
| 2024-03-14 | Modified Tally State enum    | /         | - Added new Tally State mode and changed enum Names                             | Müller / Brauner |
| 2024-03-13 | Added additinal multicam related variables | /         | - Add Variable "Multicam RET IN Selector "<br>- Add Variable "Multicam FCA IP"<br>- Add Variable "SDI2 Direction" | Weshahy |
| 2024-03-12 | Added additional Multicam related variables | /         | - Add Variable "Camera Channel Number"<br>- Add Variable "Lens Focus Position"<br>- Add Variable "Lens Focus Speed"<br>- Add Variable "Lens Zoom Speed" | Müller / Brauner |
| 2024-02-20 | Added items introduced with protocol version 1.12 | /         | - Add prerecording duration effective<br>- Add variables for ALEXA 35 Multicam mode | Heß / Bäumler |

### Past Changes

| Date       | Change Note                                      | Bug fixes | Author   |
|------------|--------------------------------------------------|-----------|----------|
| 2023-09-12 | Added items introduced with protocol version 1.11 |           | - Add monitoring zoom variables<br>- Add commands to set/get custom DRTs | Daasch  |
| 2023-07-27 | Added items introduced with protocol version 1.10 | /         | Extension of the getcliplist command with more data | Siegmund |
| 2023-04-17 | Added items introduced with protocol version 1.8 and 1.9 | /         | Extension of existing variables 0x60, 0x62, 0x64, 0x66 with a subelement to each array element. Use subelement count in array header to ignore unwanted fields | Daasch  |
| 2023-02-20 | Added items introduced with protocol version 1.7 | /         |          | Püttmann |

2021-08-09

Added items introduced with

protocol version 1.5.

New commands:

DescribeVariables

GetVariableNames

New variables:

Genlock Sync Shift

Genlock Sync Shift

Scale

Look Modified

/

Püttmann

2021-07-16

Added items introduced with

protocol version 1.4

/

Weshahy

2020-02-21

Added items introduced with

protocol version 1.3

(see chapter 3)

CAP server does not respond to LIVE command

during active framegrab

-> CAP server behavior has been modified to reply

to commands while waiting for framegrab to be

prepared.

Weshahy

2019-07-24

Added items introduced with

protocol version 1.2

(see chapter 3)

CAP server sends Camera Type in

Welcome command -> Welcome message

now includes a string containing camera

type which is sent after the CAP protocol

version.

CAP server sends welcome message with

TooManyClients to 5th client -> If a fifth

client tries to connect to CAP, the camera

replies with welcome message with result

value TooManyClients before closing the

connection.

Eliminate the limit to only generate ALE for

50 clips -> The number of clips in the

generate ALE command is now no longer

limited.

Remove empty event from "Active

Messages Events" variable-> When there is

no active messages events, CAP no longer

sends an empty event message with index

0.

Activate connection timeout -> The CAP

server disconnects from clients if no

commands are received. A CAP client

needs to send a command at least once per

second.

Grafwallner

2019-05-26

Added description on how to

calculate the AlertStateID in

GetAlertStateInfo

/

Jonas

2018-05-30

Added table "Available CAP

Features"

/

Grafwallner

2018-03-19

Added items introduced with

protocol version 1.1

/

Püttmann

(see chapter 3)

2017-11-08

Fixed Welcome message

documentation 

/

Püttmann

 

2017-09-29

Added variables “Camera

Index”, “SDI In Mode”, and

“Tally State”

/

Püttmann

 

 2017-09-19

 Added variables “Mon

Processed” and “Exposure

Unit”, some clarifications

/

Püttmann

 2017-05-04

 Added CAP 2 Features,

bumped protocol version to

1.0

(see chapter 3)

/

Püttmann

 2017-04-20

 Added HDR Color Space

names, adjusted text

/

Mayer

 2016-08-17

 Added info that Look

Filename must not exceed

32 chars

/

Mayer

 2016-04-12

 Corrected

LutDesignDataChunk

Identification field from

U32[32] to U8[64]

/

Mayer

 2016-01-03

 Added Name Lut data

telegrams

/

Mayer

 2015-10-30

 Text trims in Introduction

and Title, reformatting

/

Rädlein

 2015-10-02

 Changed “CDL Server” to

“CAP”, included rejection of

long names

/

Meister

 2015-09-28

 Changed Protocol to V 0.9,

every data field includes

data type

/

Mayer

 2015-06-09

 Added 3D Lut and

Framegrabs

/

Mayer

 2015-02-25 
Initial Version 
/

Mayer

 

## Table of Contents

1   Introduction
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
9

2   Overview
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
9

3   Available CAP Features
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
10

3.1   List of Commands
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
10

3.2   List of Variables
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
13

3.3   List of Media Status Information
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
32

3.4   List of Metadata from GetClipList
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
32

3.5   List Entry Flags
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
33

4   Communication Principles
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
33

4.1   General Message Structure
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
33

4.1.1   Message Header
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
33

4.1.2   Message Body
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
33

4.2   Commands and Replies
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
33

4.3   Camera Variables/Parameters
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
34

5   Client Authorization
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
34

5.1   CAP connections per camera
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
34

6   Data Types
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
35

6.1   Strings and Blobs (grabs, MetaData, CDL etc.)
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
35

6.2   Arrays
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
35

6.3   Enums
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
35

6.3.1   List of Data Types
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
35

6.3.2   List of Result data
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
35

6.3.3   Camera State
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
36

6.3.4   Project Rate
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
37

6.3.5   Look Switch
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
37

6.3.6   Frame Grab Source
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
37

6.3.7   Frame Grab Format
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
38

6.3.8   Test Images
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
38

6.3.9   Medium Type
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
38

6.3.10   Medium Status
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
38

6.3.11   RecordingMode
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
39

6.3.12   Exposure Unit
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
39

6.3.13   SDI In Mode
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
39

6.3.14   Tally State
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
39

6.3.15   TC Run Mode
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
39

6.3.16   TC Mode
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
39

6.3.17   Audio Level Mode
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
40

6.3.18   LDS State Flags
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
40

6.3.19   SDI Color Space
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
40

6.3.20   Look File Type
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
40

6.3.21   Power Priority
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
40

6.3.22   Bat Unit Preference
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
41

6.3.23   Power Type
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
41

6.3.24   Battery State
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
41

6.3.25   Power Input Status
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
41

6.3.26   Playback End Mode
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
41

6.3.27   Sensor Mirroring
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
42

6.3.28   List of Button Actions
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
42

6.3.29   Recording Processing
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
45

6.3.30   Wifi State
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
45

6.3.31   Video Paths
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
45

7   Commands
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
45

7.1   Live (0x0080)
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
45

7.2   RequestPwdChallenge
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
46

7.3   Password
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
46

7.4   ClientName
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
46

7.5   RequestVariables (0x0084)
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
46

7.6   Un-RequestVariables (0x0085)
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
46

7.7   SetVariable
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
47

7.8   Welcome
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
47

7.9   GetFrameGrab
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
48

7.10   Get3DLutFile
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
48

7.11   Set3DLutFile
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
48

7.12   Get3DLutData
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
49

7.13   Set3DLutData
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
50

7.14   SaveLookFile
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
50

7.15   ImgCompareUpload
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
51

7.16   ImgCompareSwitch
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
51

7.17   GetVariable (0x0090)
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
52

7.18   AutoWhiteBalance
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
52

7.19   AudioLevelMode
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
52

7.20   AudioGain
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
53

7.21   GetAlertStateInfo
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
53

7.22   ClearMessageEvent (0x0099)
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
53

7.23   RecordStart
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
54

7.24   RecordStop
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
54

7.25   StopMotionTrigger
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
54

7.26   GetClipList
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
55

7.27   Generate ALE
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
55

7.28   Complete ALE
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
56

7.29   PlaybackEnter
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
56

7.30   PlaybackExit
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
57

7.31   PlaybackStart
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
57

7.32   PlaybackPause
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
57

7.33   PlaybackClipSkip
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
57

7.34   PlaybackShuttle
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
58

7.35   PlaybackSpeed
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
58

7.36   LoadSetupFile
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
59

7.37   LoadLookFile
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
59

7.38   InstallLookFile
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
59

7.39   DeleteLookFile
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
60

7.40   LoadFrameline
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
60

7.41   UnloadFrameline
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
61

7.42   AddFrameline
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
61

7.43   DeleteFrameline
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
61

7.44   GetSetupFile
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
62

7.45   AddSetupFile
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
62

7.46   AddSensorFPS
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
63

7.47   DeleteSensorFPS
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
63

7.48   AddShutter
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
64

7.49   DeleteShutter
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
64

7.50   AddExposureTime
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
65

7.51   DeleteExposureTime
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
65

7.52   AddWhiteBalance
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
66

7.53   DeleteWhiteBalance
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
66

7.54   DescribeVariables
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
66

7.55   GetVariableNames
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
67

7.56   SaveSetup 0x00bb
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
67

7.57   GetFrameline 0x00bc
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
67

7.58   AddTexture 0x00e0
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
68

7.59   DeleteTexture 0x00e1
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
68

7.60   LoadTexture 0x00e2
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
69

7.61   GetTexture 0x00e3
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
69

7.62   AddLensTable 0x00e7
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
70

7.63   InstallLensTable 0x00e8
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
70

7.64   DeleteLensTable 0x00e9
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
71

7.65   InspectLensTable 0x00ea
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
71

7.66   LoadLensTable 0x00eb
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
72

7.67   UnloadLensTable 0x00ec
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
72

7.68   GetLensTable 0x00ed
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
72

7.69   AddLensTableFav 0x00ee
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
73

7.70   DeleteLensTableFav 0x00ef
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
73

7.71   AddLookFile 0x00f0
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
73

7.72   RenameLookFile 0x00f1
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
74

7.73   DuplicateLookFile 0x00f2
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
74

7.74   GetLookFile 0x00f3
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
75

7.75   Get3DLutDataEx 0x00f4
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
75

7.76   Set3DLutDataEx 0x00f5
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
75

7.77   EvalRecordingFormat 0x00f6
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
76

7.78   SetRecordingFormat 0x00f7
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
77

7.79   ButtonPress 0x00f8
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
77

7.80   ButtonRelease 0x00f9
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
77

7.81   ButtonAssign 0x0100
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
78

7.82   ClearMsgEvents 0x00FB
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
78

7.83   SetAudioRecSrc 0x0101
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
78

7.84   SetTCToCameraTime
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
78

7.85   GetDRTData 0x0103
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
78

7.86   SetDRTData 0x0104
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
79

8   Variables
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
79

8.1   CDL Values
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
79

8.2   Look Filename
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
80

8.3   Active Alert States
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
80

8.4   Active Message Events
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
80

8.5   Media Status
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
80

8.6   Audio Level Mode 0x0076
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
81

8.7   Audio Gain 0x0077
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
81

8.8   Rec Resolution List 0x0026
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
81

8.9   Lens Table 0x00A7
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
82

8.10   Lens Table Favorites 0x00A8
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
82

8.11   Wlan Host Channel 0x00D1
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
82

8.12   Wlan ACS Restriction 0x00D3
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
82

8.13   Timecode Source 0x00D4
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
83

8.14   Camera Temperature States 0x00EF
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
83

8.15   Auto White Balance (AutoWB) 0x00E8
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
83

8.16   Sensor Mode List 0x00F2
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
83

8.17   USB State 0x00F6
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
83

8.18   Reactive Soft Buttons 0x00FA
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
84

8.19   Status Info Data 0x00FC, 0x00FD, 0x00FE
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
84

8.20   Live Image Area 0x00FF
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
84

8.21   LDS Iris 0x0103
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
85

8.22   Monitoring Zoom
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
86

8.23   Monitoring Zoom Position
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
86

8.24   Monitoring Zoom Factor
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
86

9   Limitations
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
86

10   Contact
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
 .
86

## 1 Introduction

The Camera Access Protocol (CAP) is used to control and monitor the ARRI cameras via a network connection. The protocol
incorporates functions to perform color grading, query and set variables such as the exposure index, start and stop a recording
and much more. It is currently available for the ALEXA 35, ALEXA Mini LF, ALEXA SXT, ALEXA LF, ALEXA 65, ALEXA Mini

and AMIRA camera lines. Note that not all functions are available on all camera models. See chapter 3 - Available CAP

Features.

## 2 Overview

The CAP server runs on the camera as a server process and listens on port 5055.

The protocol is binary (easier to implement, faster) and uses TCP/IP, therefore no further message safeguarding is necessary.

Values represented by multiple bytes are transferred in Big Endian format.

When a client establishes the TCP/IP connection, the camera sends a Welcome message, which includes the protocol version

and a connection result which is either Result_OK or Result_TooManyClients.

If the client is accepted (Result_OK), it has to authorize itself by requesting a password challenge. This password challenge is

to be concatenated to the password itself (settable via camera GUI). The MD5 hash sum of the result is then transferred to the

camera for authorization. See chapter 5 - Client Authorization for details.

There is some configuration data that the client is able to request from the camera including camera type, serial number etc.
These configuration data is accessible like any other variable inside the CAP.

Every command sent to the server includes a unique command ID. For every received command, the server sends a response,

together with that unique command ID. Therefore the client is able to easily match the response with a formerly sent command.

During an active connection the client sends a “live beacon” in form of the Live command (or any other command) to the

camera every second. This beacon is replied to as well, so the client also knows the camera is still here. This is to detect a

disconnected network a little bit sooner than with the rather long TCP timeout. The responses are sequential, so if the client is

receiving a big response (e.g framegrab), the CAP server will respond to live command (or any other command) only after the

big response is completely sent.

Apart from the CDL values, the camera has a few more parameters to distribute (and/or to receive) over CAP (FPS, EI,
LookFileName …). These are all handled in a unique fashion with the same command code. See chapter 8 - Variables.

## 3 Available CAP Features

### 3.1 List of Commands

CAP-973 - Commands

No.
NAME
CAP Version
Cmd Code
ALEXA  SXT/LF/65
ALEXA 35/Mini/Mini LF

/AMIRA

1
Live
0.9
0x0080
SUP 1.0 and later
SUP 5.0 and later

2
RequestPwdChallenge
0.9
0x0081
SUP 1.0 and later
SUP 5.0 and later

3
Password
0.9
0x0082
SUP 1.0 and later 
SUP 5.0 and later

4
ClientName
0.9
0x0083
SUP 1.0 and later 
SUP 5.0 and later

5
RequestVariables
0.9
0x0084
SUP 1.0 and later 
SUP 5.0 and later

6
Un-RequestVariables
0.9
0x0085
SUP 1.0 and later 
SUP 5.0 and later

7
SetVariable
0.9
0x0086
SUP 1.0 and later 
SUP 5.0 and later

8
Welcome
0.9
0x0087
SUP 1.0 and later 
SUP 5.0 and later

9
GetFrameGrab
0.9
0x0088
SUP 1.0 and later 
SUP 5.0 and later

10
Get3DLutFile
0.9
0x0089
SUP 1.0 and later 
SUP 5.0 and later

11
Set3DLutFile
0.9
0x008a
SUP 1.0 and later 
SUP 5.0 and later

12
Get3DLutData
0.9
0x008b
SUP 1.0 and later  
SUP 5.0 and later

13
Set3DLutData
0.9
0x008c
SUP 1.0 and later
SUP 5.0 and later

14
SaveLookFile
0.9
0x008d
SUP 1.0 and later 
SUP 5.0 and later

15
GetVariable
0.9
0x0090
SUP 1.0 and later 
SUP 5.0 and later

16
ImgCompareUpload
0.9
0x008e
SUP 1.0 and later
not available

17
ImgCompareSwitch
0.9
0x008f
SUP 1.0 and later
not available 

18
AutoWhiteBalance
1.0
0x0091
no
SUP 5.1 and later

19
RecordStart
1.0
0x00a0
no
SUP 5.1 and later

20
RecordStop
1.0
0x00a1
no
SUP 5.1 and later

21
StopMotionTrigger
1.0
0x00a2
no
SUP 5.1 and later

22
LoadSetupFile
1.0
0x00b0
no
SUP 5.1 and later

23
LoadLookFile
1.0
0x00b1
no
SUP 5.1and later

24
PlaybackEnter
1.1
0x00a8
no
SUP 5.3 and later

25
PlaybackExit
1.1
0x00a9
no
SUP 5.3 and later

26
PlaybackStart
1.1
0x00aa
no
SUP 5.3 and later

27
PlaybackPause
1.1
0x00ab
no
SUP 5.3 and later

28
PlaybackClipSkip
1.1
0x00ac
no
SUP 5.3 and later

29
PlaybackShuttle
1.1
0x00ad
no
SUP 5.3 and later

30
PlaybackSpeed
1.1
0x00ae
no
SUP 5.3 and later

31
InstallLookFile from Lool Library
1.1
0x00b2
no
SUP 5.3 and later 

32
Access to camera alerts & events
1.1
0x0098
no
SUP 5.3 and later 

33
 ClearMessageEvent
1.1
0x0099
no
SUP 5.3 and later

34
GetClipList 
1.1
0x00a4
 
 
 

35
Generate ALE Clip List from medium
1.1
0x00a5
no
SUP 5.3 and later 

36
DeleteLookFile
1.2
0x00b3
no
SUP 6.0 and later

37
CompleteALE
1.2
0x00a6
no
SUP 6.0 and later

38
LoadFrameline
1.3
0x00b5
no
SUP 6.1 and later

39
UnloadFrameline
1.3
0x00b6
no
SUP 6.1 and later

40
AddFrameline
1.3
0x00b7
no
SUP 6.1 and later

41
DeleteFrameline
1.3
0x00b8
no
SUP 6.1 and later

42
GetSetupFile
1.3
0x00b9
no
SUP 6.1 and later

43
AddSetupFile
1.3
0x00ba
no
SUP 6.1 and later

44
AddSensorFPS
1.3
0x00d0
no
SUP 6.1 and later

45
DeleteSensorFPS
1.3
0x00d1
no
SUP 6.1 and later

46
AddShutter
1.3
0x00d2
no
SUP 6.1 and later

47
DeleteShutter
1.3
0x00d3 
no
SUP 6.1 and later

48
AddExposureTime
1.3
0x00d4
no
SUP 6.1 and later

49
DeleteExposureTime
1.3 
0x00d5
no
SUP 6.1 and later

50
AddWhiteBalance
1.3
0x00d6
no
SUP 6.1 and later

51
DeleteWhiteBalance
1.3 
0x00d7
no
SUP 6.1 and later

52
AudioLevelMode
1.3
0x0092
no
SUP 6.1 and later

53
AudioGain
1.3
0x0093
no
SUP 6.1 and later

54
DescribeVariables
1.5
0x00C0
no
SUP 7.1 and later

55
GetVariableNames
1.5
0x00C1
no
SUP 7.1 and later

56
SaveSetup
1.7
0x00BB
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

57
GetFrameline
1.7
0x00BC
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

58
AddTexture
1.7
0x00E0
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

59
DeleteTexture
1.7
0x00E1
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

60
LoadTexture
1.7
0x00E2
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

61
GetTexture
1.7
0x00E3
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

62
AddLensTable
1.7
0x00E7
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

63
InstallLensTable
1.7
0x00E8
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

64
DeleteLensTable
1.7
0x00E9
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

65
InspectLensTable
1.7
0x00EA
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

66
LoadLensTable
1.7
0x00EB
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

67
UnloadLensTable
1.7
0x00EC
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

68
GetLensTable
1.7
0x00ED
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

69
AddLensTableFav
1.7
0x00EE
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

70
DeleteLensTableFav
1.7
0x00EF
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

71
AddLookFile
1.7
0x00F0
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

72
RenameLookFile
1.7
0x00F1
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

73
DuplicateLookFile
1.7
0x00F2
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

74
GetLookFile
1.7
0x00F3
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

75
Get3DLutDataEx
1.7
0x00F4
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

76
Set3DLutDataEx
1.7
0x00F5
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

77
EvalRecordingFormat
1.7
0x00F6
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

78
SetRecordingFormat
1.7
0x00F7
no
SUP 7.2 + ALEXA 35 SUP

1.0 and later

79
ButtonPress
1.9
0x00F8
no
SUP 7.3 + ALEXA 35 SUP

1.1 and later

80
ButtonRelease
1.9
0x00F9
no
SUP 7.3 + ALEXA 35 SUP

1.1 and later 

81
ButtonAssign
1.9
0x0100
no
SUP 7.3 + ALEXA 35 SUP

1.1 and later 

82
ClearMsgEvents
1.10
0x00FB
no
SUP 7.3 + ALEXA 35 SUP

1.2 and later

83
SetAudioRecSrc
1.10
0x0101
no
SUP 7.3 + ALEXA 35 SUP

1.2 and later 

84
SetTCToCameraTime
1.10
0x0102
no
SUP 7.3 + ALEXA 35 SUP

1.2 and later 

85
SetDRTData
1.11
0x0103
no
ALEXA 35 SUP 1.2.1

86
SetDRTData
1.11
0x0104
no
ALEXA 35 SUP 1.2.1

### 3.2 List of Variables

CAP-974 - Variables

N

o.

NAME
CAP

Version

VarID
Type
Read

mode

Remarks
ALEXA 

SXT/LF/65

ALEXA 35/Mini/Mini

LF /AMIRA

1
Camera Type
0.9
0x0001
string 
read

only

“Alexa SXT”
SUP 1.0

and later

SUP 5.0 and later

2
Camera Serial
0.9
0x0002
string
read

only

“6002”
SUP 1.0 

and later

SUP 5.0 and later

3
Camera State
0.9
0x0040
U16
read

only

Bitfield with

CameraState enum bits

SUP 1.0

and later

SUP 5.0 and later

4
Look Filename
0.9
0x0041
string
read

only

w/o .ending
SUP 1.0

and later

SUP 5.0 and later

5
CDL Values
0.9
0x0050
BLOB
 

List of 10x F32
SUP 1.0

and later

SUP 5.0 and later

6
Color Temperature
0.9
0x0051
U32
 

WhiteBalance [Kelvin]
SUP 1.0

and later

SUP 5.0 and later

7
Tint
0.9
0x0052
F32
 

WhiteBalance Tint Value
SUP 1.0

and later

SUP 5.0 and later

8
Exposure Index
0.9
0x0053
U32
 

EI in Asa, see Exposure

Index List for possible

values

SUP 1.0

and later

SUP 5.0 and later

9
Look Switch EVF
0.9
0x0054
enum
 

LookSwitch (6.3.5)
SUP 1.0

and later

SUP 5.0 and later

10
Look Switch Mon1
0.9
0x0055
enum
 

 
SUP 1.0

and later

SUP 5.0 and later

11
Look Switch Mon2
0.9
0x0056
enum
 

 
SUP 1.0

and later

SUP 5.0 and later

12
Look Switch Mon3
0.9
0x0057
enum
 

 
SUP 1.0

and later

SUP 5.0 and later

13
Sensor FPS List
1.0
0x0060
array
read

only

Each array element

consists of: F32: fps, (&

U32: bitfield with List

Entry Flags since v1.9)

no
SUP 5.1 and later

14
Sensor FPS
1.0
0x0061
F32
 

Is not required to be

contained in Sensor

FPS List

no
SUP 5.1 and later

15
Shutter Angle List
1.0
0x0062
array
read

only

Each array element

consists of a single F32,

(& U32: bitfield with List

Entry Flags since v1.9)

no
SUP 5.1 and later

16
Shutter Angle
1.0
0x0063
F32
 

Is not required to be

contained in Shutter

Angle List

no
SUP 5.1 and later

17
Exposure Time List
1.0
0x0064
array
read

only

Each array element

consists of a single F32,

no
SUP 5.1 and later

(& U32: bitfield with List

Entry Flags since v1.9)

18
Exposure Time
1.0
0x0065
F32
 

Is not required to be

contained in Exposure

Time List

no
SUP 5.1 and later

19
Exposure Index List
1.0
0x0066
array
read

only

Each array element

consists of a single U32,

(& U32: bitfield with List

Entry Flags since v1.9)

no
SUP 5.1 and later

20
ND Filter List
1.0
0x0067
array
read

only

Each array element

consists of a single U16,

read-only

no
SUP 5.1 and later

21
ND Filter
1.0
0x0068
enum
 

Optical density, see ND

Filter List for possible

values

no
SUP 5.1 and later

22
White Balance List
1.0
0x0069
array
read

only

Each array element

consists of a triple (CCT

in Kelvin: F32, Tint: F32,

Name: string), read-only

no
SUP 5.1 and later

23
Focus Tool Mon
1.0
0x006a
array
 

Each array element –

one per Mon out –

consists of a single bool,

writeable

no
SUP 5.1 and later

24
Exposure Tool Mon
1.0
0x006b
array
 

Each array element –

one per Mon out –

consists of a single bool,

writeable

no
SUP 5.1 and later

25
Test Image
1.0
0x006c
enum
 

TestImage (6.3.8)
no
SUP 5.1 and later

26
Media Status
1.0
0x006d
array
read

only

See section 8.5
no
SUP 5.1 and later

27
User Setup List
1.0
0x006e
array
read

only

Each array element –

one per internally stored

setup file –

consists of a

single string containing

the name of the file

no
SUP 5.1 and later

28
Look File List
1.0
0x006f
array
read

only

Each array element –

one per internally stored

look file – consists of a

single string containing

the name of the file

no
SUP 5.1 and later

29
Recording Mode
1.0
0x0070
enum
 

RecordingMode (6.3.11)
no
SUP 5.1 and later

30
Camera Index
1.0
0x0003
U16
 

Value corresponding to

the index letter assigned

to the camera, Value

Range A-Z  (A= 0 -- Z =

25)

no
SUP 5.2 and later

31
Mon Processed
1.0
0x0058
array
 

Each array element

consists of a single bool,

read-only

no
SUP 5.2 and later

32
SDI In Mode
1.0
0x0059
enum
 

SDI_InMode (6.3.13)
no
SUP 5.2 and later

33
Tally State
1.0
0x005a
enum
 

TallyState (6.3.14)
no
SUP 5.2 and later

34
Exposure Unit
1.0
0x0071
enum
 

ExposureUnit (6.3.12)
no
SUP 5.2 and later

35
Current Date
1.1
0x0010
string
 

Always in the following

system time format:

"YYYY-MM-DD

HH:MM:SS"

no
SUP 5.3 and later

36
Project Rate
1.1
0x0020
enum
 

ProjectRate (6.3.4).

Enumeration value

symbols ending with 'I'

(e.g. PR_59940i)

represent interlaced

frame rates.

no
SUP 5.3 and later

37
Active Alert States
1.1
0x0048
BLOB
read

only

Bitset of active alert

states, read-only. See

section 8.3 "Active Alert

States"

no
SUP 5.3 and later

38
Active Message Events
1.1
0x0049
array
read

only

Each array element

consists of a pair (event

ID: U16, message text:

string). Read-only.

no
SUP 5.3 and later

39
Active Medium
1.1
0x005b
U16
 

The ID is the index into

the array exposed

through variable Media

Status (0x006d) or 0xffff

if no active Medium is

present.

no
SUP 5.3 and later

40
Timecode
1.1
0x0078
U32
 

BCD timecode:

HHMMSSFF

no
SUP 5.3 and later

41
Timecode Offset
1.1
0x0079
S32
 

User-configurable

timecode offset

no
SUP 5.3 and later

42
Timecode Run Mode
1.1
0x007a
enum
 

TC_RunMode (6.3.15).
no
SUP 5.3 and later

43
Timecode Init Mode
1.1
0x007b
enum
 

TC_InitMode (6.3.16).
no
SUP 5.3 and later

44
Timecode Drop Mode
1.1
0x007c
U8/bool
 

Drop frame mode flag
no
SUP 5.3 and later

45
Last Rec Medium
1.1
0x007e
U16
read

only

ID of the medium

containing the last

recorded clip. Useful in

combination with Last

REC Clip ID. Read-only.

no
SUP 5.3 and later

46
Last Rec Clip Index
1.1
0x007f
U16
read

only

Index of the last

recorded clip. Useful in

combination with Last

REC Medium ID to be

fed into command

GetClipList (0x00a4).

Read-only.

no
SUP 5.3 and later

47
Lens Model
1.1
0x0080
string
read

only

Model of the attached

lens.

no
SUP 5.3 and later 

48
Lens Serial Number
1.1
0x0081
string
read

only 

Serial number of the

attached lens.

no
SUP 5.3 and later 

49
Lens Focus
1.1
0x0082
S32
read

only

Lens focus distance in

mm, 0 for

invalid/unknown, -1 for

infinity.

no
SUP 5.3 and later 

50
Lens Iris
1.1
0x0083
S32
read

only

Lens iris value in

1/1000th stops, with

1000 = T1, -1 for invalid,

-2 for closed and -3 for

near closed iris.

no
SUP 5.3 and later 

51
Lens Focal Length
1.1
0x0084
S32
read

only

Lens zoom (focal length)

in 1/1000th mm, 0 for

invalid/unknown

no
SUP 5.3 and later 

52
Clip Scene
1.1
0x0096
string
 

Descriptive metadata

item for maximum 16

characters

no
SUP 5.3 and later 

53
Clip Take
1.1
0x0097
string
 

Descriptive metadata

item for maximum 08

characters

no
SUP 5.3 and later 

54
Production
1.1
0x0090
string
 

Descriptive metadata

item for maximum 32

characters

no
SUP 5.3 and later 

55
Production Company
1.1
0x0091
string
 

Descriptive metadata

item for maximum 32

characters

no
SUP 5.3 and later

56
Director
1.1
0x0092
string
 

Descriptive metadata

item for maximum 32

characters

no
SUP 5.3 and later 

57
Cinematographer
1.1
0x0093
string
 

Descriptive metadata

item for maximum 32

characters

no
SUP 5.3 and later 

58
Camera Operator
1.1
0x0094
string
 

Descriptive metadata

item for maximum 32

characters

no
SUP 5.3 and later 

59
Location
1.1
0x0095
string
 

Descriptive metadata

item for maximum 64

characters

no
SUP 5.3 and later 

60
User Info 1
1.1
0x0098
string
 

Descriptive metadata

item for maximum

128 characters

no
SUP 5.3 and later 

61
User Info 2
1.1
0x0099
string
 

Descriptive metadata

item for maximum 128

characters

no
SUP 5.3 and later 

62
Playback Clip Index
1.2
0x0085
U16
read

only

This variable returns the

index of the clip

currently in playback in

no
SUP 6.0 and later

in the clip list which can

be retrieved via the

GetClipList command.

63
Remaining Rec Time
1.2
0x0072
U32
read

only

This variable holds the

remaining time to record

with current settings as

a count of seconds.

no
SUP 6.0 and later

64
Battery Voltage
1.2
0x0011
F32
read

only 

This variable holds

electrical voltage of the

connected battery in

Volts.

no
SUP 6.0 and later

65
Battery Capacity
1.2
0x0012
U32
read

only

This variable holds the

remaining charge of the

connected battery in

percent.

no
SUP 6.0 and later

66
Main Voltage
1.3
0x0013
F32
read

only

Current voltage on

the main power

supply connector.

no
SUP 6.1 and later

67
Current Reel
1.3
0x005c
U16
read

only

Current reel count

no
SUP 6.1 and later

68
Clip Number
1.3
0x005d
U16
read

only

Clip number displayed

on home screen

no
SUP 6.1 and later

69
Prerecord Duration
1.3
0x0073
F32
 

 
no
SUP 6.1 and later

70
Master Black Pedestal
1.3
0x002F
F32
 

Master black pedestal

that offsets RGB video

pedestal.ALEXA 35:

Only available in

Multicam mode.

no
SUP 6.1 +

ALEXA 35 SUP 1.3 and

later

71
Video Pedestal
1.3
0x0030
array
 

List of 3x F32 RGB

pedestals.

ALEXA 35: Only

available in Multicam

mode.

no
SUP 6.1 +

ALEXA 35 SUP 1.3 and

later

72
Video Slope
1.3
0x0031
array
 

List of 3x F32 RGB

slopes

no
SUP 6.1 and later

73
Video Gamma RGB
1.3
0x0032
array
 

List of 3x F32 RGB

gammas

no
SUP 6.1 and later

74
Video Knee
1.3
0x0033
F32
 

Active video knee in the

active look.

ALEXA 35: Only

available in Multicam

mode.

no
SUP 6.1 and later +

ALEXA 35 SUP 1.3 and

later

75
Video Gamma
1.3
0x0034
F32
 

Active video gamma in

the active look

no
SUP 6.1 and later

76
Video Saturation
1.3
0x0035
F32
 

Active video saturation

in the active look

no
SUP 6.1 and later

77
Black Gamma
1.3
0x0036
F32
 

Active video black

gamma in the active

look.

ALEXA 35: Only

available in Multicam

mode.

no
SUP 6.1 +

ALEXA 35 SUP 1.3 and

later

78
Video Saturation Red
1.3
0x0037
F32
 

Active video saturation

red in the active look

no
SUP 6.1 and later

79
Video Saturation Yellow
1.3
0x0038
F32
 

Active video saturation

yellow in the active look

no
SUP 6.1 and later

80
Video Saturation Green
1.3
0x0039
F32
 

Active video saturation

green in the active look

no
SUP 6.1 and later

81
Video Saturation Cyan
1.3
0x003a
F32
 

Active video saturation

cyan in the active look

no
SUP 6.1 and later

82
Video Saturation Blue
1.3
0x003b
F32
 

Active video saturation

blue in the active look

no
SUP 6.1 and later

83
Video Saturation Magenta
1.3
0x003c
F32
 

Active video saturation

magenta in the active

look

no
SUP 6.1 and later

84
Frameline List
1.3
0x0047
array
read

only

List of available

framelines in the internal

storage of the camera.

Array consisting of the

following items per

element:

String: name of

frameline file

U8: flag to

indicate if the

frameline can be

applied with the

current camera

settings

no
SUP 6.1 and later

85
Filter Sharpness
1.3
0x0074
F32
 

Current Filter Sharpness
no
SUP 6.1 and later

86
Audio Level Mode
1.3
0x0076
array
read

only

Array of struct (U8,
U16) see section

8.6.

no
SUP 6.1 and later

87
Audio Gain
1.3
0x0077
array
read

only

Array of struct (U8,

F32) see section 8.7.

no
SUP 6.1 and later

88
LDS State Flags
1.4
0x0086
U32
read

only

 
no
SUP 7.0 and later

89
Lens Converter Short

Description

1.4
0x0087
string
read

only

 
no
SUP 7.0 and later

90
Lens Converter Long

Description

1.4
0x0088
string
read

only

 
no
SUP 7.0 and later

91
Lens Converter Serial
1.4
0x0089
string
read

only

 
no
SUP 7.0 and later

92
Lens Converter Physical

Length

1.4
0x008a
U32
read

only

 
no
SUP 7.0 and later

93
Lens Converter Light Loss
1.4
0x008b
U32
read
 
no
SUP 7.0 and later

only

94
Lens Converter Focal

Length Multiplier

1.4
0x008c
U32
read

only

 
no
SUP 7.0 and later

95
Genlock Sync Shift
1.5
0x005f
F32
 

Genlock sync shift, in µs

(microseconds)

no
SUP 7.1 and later

96
Genlock Sync Shift Scale
1.5
0x005e
F32
read

only

Scale / granularity of the

Genlock Sync Shift

value, in µs

no
SUP 7.1 and later

97
Look Modified
1.5
0x0042
U8/bool
read

only

Flag indicating whether

the currently active look

has been modified by

the user

no
SUP 7.1 and later

98
Camera Index 2
1.7
0x0004
U16
 

Value corresponding to

the second index letter

assigned to the camera,

value range 'A'-'Z' and

'_' ('_'=0, 'A'=1, …,

'Z'=26)

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

99
Frameline
1.7
0x0046
string
read

only

Filename of the

currently active frame

line

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

100 Codec List
1.7
0x0024
array
read

only

Each array element

consists of a pair (string,

U32) containing the

codec name and the bit

set of compatible

recording resolutions

per index in the Rec

Resolution List variable

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

101 Codec
1.7
0x0025
enum
read

only

Index of the currently

active codec per Codec

List

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

102 Rec Resolution List
1.7
0x0026
array
read

only

Each array element

consists of a 8-tuple of

values describing a

recording resolution, see

section 8.8

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

103 Recording Resolution
1.7
0x0027
enum
read

only

Index of the currently

active recording

resolution per Rec

Resolution List

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

104 Texture List
1.7
0x00A0
array
read

only

Each array element –

one per internally stored

texture – consists of a

single string containing

the name of the texture

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

105 Texture
1.7
0x00A1
string
read

only

Filename of the

currently active texture

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

106 Color Space SDI1
1.7
0x00A2
enum
 

Color space of SDI1,

values from

SDIColorSpace (6.3.19)

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

107 Color Space SDI2
1.7
0x00A3
enum
 

Color space of SDI2,

values from

SDIColorSpace (6.3.19)

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

108 Look File Type
1.7
0x00A4
U16
read

only

Look file type supported

by the camera. Bitfield

with LookFileType enum

bits. Modeled as a bit

field as in theory a

camera could support

multiple look file types.

In practice currently

treated as an enum.

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

109 Lens Table List
1.7
0x00A5
array
read

only

List of installed lens

tables; each array

element consists of a

single string containing

the name of the lens

table

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

110 Lens Table Archive
1.7
0x00A6
array
read

only

List of lens tables in the

built-in archive; each

array element consists

of a single string

containing the name of

the lens table

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

111 Lens Table
1.7
0x00A7
array
read

only

Single element array,

where its only entry

consists of a 6-tuple of

values describing the

currently active lens

table, see section 8.9

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

112 Lens Table Favorites
1.7
0x00A8
array
read

only

Each array element

consists of a triple of

values describing one

entry in the favorites

table, see section 8.10

(filename, display name,

scale class)

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

113 Look Intensity
1.7
0x00A9
F32
 

Look intensity, in the

range of 0-1. Variable L

ook Intensity Scale dete

rmines the available

values in that range

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

114 Look Intensity Scale
1.7
0x00AA
F32
read

only

Unit of change for the Lo

ok Intensity value

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

115 Look LUT Mesh Points
1.7
0x00AB
U16
read

only

Number of mesh points

per channel of the

currently active 3D LUT,

0 if a parametric look

with no materialized

LUT is active

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

116 Power Priority
1.7
0x00B0
enum
 

User preference

regarding priority of

power inputs, see

PowerPriority (6.3.21)

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

117 BAT Unit Preference
1.7
0x00B1
enum
 

User preference

regarding unit

(Volt/percent) of power

level indication &

warnings, see

BatUnitPreference

(6.3.22)

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

118 PWR BAT LEDs
1.7
0x00B2
bool
 

Setting (on/off) for

PWR/BAT LED

indicators

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

119 BAT Auto Boot Up
1.7
0x00B3
bool
 

Setting (on/off)

indicating whether the

camera re-powers from

battery after power-

down in low-power

situations

Note: setting this to true 

might lead to repeated

power cycles in case of

low-power batteries

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

120 BAT Warning Voltage
1.7
0x00B4
F32
 

Warning level for the

power source connected

to BAT in Volt

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

121 BAT Warning Capacity
1.7
0x00B5
U8
 

Warning level for the

power source connected

to BAT and any

additional hot-swap

battery in percent

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

122 PWR Warning Voltage
1.7
0x00B6
F32
 

Warning level for the

power source connected

to PWR in Volt

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

123 PWR Warning Capacity
1.7
0x00B7
U8
 

Warning level for the

power source connected

to PWR in percent;

applicable to smart

battery connected to

PWR connector

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

124 BAT Type
1.7
0x00B8
enum
read

only

Type of power source

connected to BAT, see

PowerType (6.3.23)

no
SUP 7.2 +

ALEXA 35 SUP 1.0 and

later

125 BAT State
1.7
0x00B9
enum
read

only

State of power source

connected to BAT, see

BatteryState (6.3.24)

no
SUP 7.2 +ALEXA 35 SUP

1.0 and later

126 BAT Voltage
1.7
0x00BA
F32
read

only

Current voltage

delivered by power

source connected to

BAT; undefined if no

power source is

connected

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

127 BAT Capacity
1.7
0x00BB
U8
read

only

Remaining capacity in

percent of the battery

connected to BAT;

undefined if BAT Type is

not 0x0002

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

128 PWR Type
1.7
0x00BC
enum
read

only

Type of power source

connected to PWR, see

PowerType (6.3.23)

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

129 PWR State
1.7
0x00BD
enum
read

only

State of power source

connected to PWR, see

BatteryState (6.3.24)

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

130 PWR Voltage
1.7
0x00BE
F32
read

only

Current voltage

delivered by power

source connected to

PWR; undefined if no

power source is

connected

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

131 PWR Capacity
1.7
0x00BF
U8
read

only

Remaining capacity in

percent of the battery

connected to PWR;

undefined if PWR Type i

s not 0x0002

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

132 Hot Swap Type
1.7
0x00C0
enum
read

only

Type of hot-swap smart

battery connected to the

back of the camera, see

PowerType (6.3.23)

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

133 Hot Swap State
1.7
0x00C1
enum
read

only

State of hot-swap smart

battery connected to the

back of the camera, see

BatteryState (6.3.24)

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

134 Hot Swap Capacity
1.7
0x00C2
U8
read

only

Remaining capacity in

percent of the hot-swap

battery; undefined if Hot

Swap Type is

not 0x0002

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

135 Power Input Status
1.7
0x00C3
U32
read

only

Current status of the

power input as a bitset,

see PowerInputStatus

(6.3.25)

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

136 Power Prio Status
1.7
0x00C4
enum
read

only

Current power priority

status, see

PowerPriority

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

137 Accessory Supply Status
1.7
0x00C5
U32
read

only

Bitset indicating which

accessories are

supplied with power, bits

are indices of Accessory

Supply List

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

138 Accessory Supply List
1.7
0x00C6
array
read

only

List of power-supplied

accessories; each array

element is a single

string containing the

symbolic name of the

accessory power

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

139 Look File Library
1.7
0x00AC
array
read

only

List of look files in the

built-in archive; each

array element consists

of a single string

containing the filename

of the look

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

140 Enhanced Sensitivity

Mode

1.7
0x00c8
U8/bool
 

Flag indicating whether

Enhanced Sensitivity

Mode is active

no
SUP 7.2 + ALEXA 35

SUP 1.0

141 ESM Minimum EI
1.7
0x00C9
U32
read

only

Minimum Exposure

Index setting that

supports Enhanced

Sensitivity Mode;

0xFFFFFFFF if

Enhanced Sensitivity

Mode is unavailable due

to operational

constraints

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

142 Playback Speed
1.7
0x00CA
S16
read

only

Current playback speed,

0 if paused

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

143 Playback Position
1.7
0x00CB
U8
read

only

Current position of the

playhead in percent, 0 if

at start of clip, 100 if at

the end

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

144 Playback End Mode
1.7
0x00CC
enum
 

PlaybackEndMode, see

6.3.26

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

145 Sensor Mirroring
1.7
0x00CD
enum
 

SensorMirroring, see

6.3.27

no
SUP 7.2 + ALEXA 35

SUP 1.0 and later

146 WRS Power
1.8
0x00CE
bool
read

only

Flag indicating whether

White Radio Power is

active

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

147 WRS Channel
1.8
0x00CF
U8
read

only

Selected White Radio

Channel

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

148 WRS Frequency
1.8
0x00D0
U16
read

only

Frequency of selected

White Radio Channel

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

149 Wlan Host Channel
1.8
0x00D1
U8
Wlan Host Channel

selection of camera

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

150 Wlan ACS Active
1.8
0x00D2
bool
read

only

Flag indicating whether

Automatic Channel

Selection is active

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later
 
 

151 Wlan ACS Restriction
1.8
0x00D3
array
List of WLAN channels

that are excluded from

Automatic Channel

Selection

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later
 
 

152 Timecode Regen Source
1.9
0x00D4
U32
read

only

Timecode source (see 8

.13 - Timecode Source

0x00D4 )

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

153 User Button Actions
1.9
0x00E5
array
read

only

Available

actions/functions that

can be assigned to user

buttons. Each array

element consists of one

U32 user button action (

6.3.28 - List of Button

Actions)

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

154 GPIO User Button Action
1.9
0x00E6
array
read

only

Available

actions/functions that

can be assigned to

GPIO user buttons.

Each array element

consists of one U32

from enum

ButtonActions

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

155 MVF User Buttons
1.9
0x00D5
array
read

only

The MVF user buttons

with their currently

assigned actions. Each

array element consists

of: String: button name,

U32: user button action (

6.3.28 - List of Button

Actions), F32: function

parameter

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

156 MVF User Button LEDs
1.9
0x00D6
array
read

only

The state of the MVF

user button LEDs. Each

array element consists

of: String: button name,

U16: LED state (0/1)

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

157 Camera User Buttons
1.9
0x00D7
array
read

only

The camera (body) user

buttons with their

currently assigned

actions. Each array

element consists of:

String: button name,

U32: user button action (

6.3.28 - List of Button

Actions), F32: function

parameter

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

158 Camera User Button

LEDs

1.9
0x00D8
array
read
The state of the camera
no
SUP 7.3 + ALEXA 35

only
user button LEDs. Each

array element consists

of: String: button name,

U16: LED state (0/1)

SUP 1.1 and later

159 Hand Unit User Buttons
1.9
0x00D9
array
read

only

The hand unit user

buttons with their

currently assigned

actions. Each array

element consists of:

String: button name,

U32: user button action (

6.3.28 - List of Button

Actions), F32: function

parameter

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

160 Hand Unit User Button

LEDs

1.9
0x00DA
array
read

only

The state of the hand

unit user button LEDs.

Each array element

consists of: String:

button name, U16: LED

state (0/1)

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

161 LBUS Device User

Buttons

1.9
0x00DB
array
read

only

The LBUS device user

buttons with their

currently assigned

actions. Each array

element consists of:

String: button name,

U32: user button action (

6.3.28 - List of Button

Actions), F32: function

parameter

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

162 LBUS Device User Button

LEDs

1.9
0x00DC
array
read

only

The state of the LBUS

device user button

LEDs. Each array

element consists of:

String: button name,

U16: LED state (0/1)

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

163 GPIO User Buttons
1.9
0x00DD
array
read

only

The GPIO user buttons

with their currently

assigned actions. Each

array element consists

of: String: button name,

U32: user button action (

6.3.28 - List of Button

Actions), F32: function

parameter

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

164 GPIO User Button LEDs
1.9
0x00DE
array
read

only

The state of the GPIO

user button LEDs. Each

array element consists

of: String: button name,

U16: LED state (0/1)
 

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

165 Lens User Buttons
1.9
0x00DF
array
read
The lens user buttons
no
SUP 7.3 + ALEXA 35

only
with their currently

assigned actions. Each

array element consists

of: String: button name,

U32:  user button action

(6.3.28 - List of Button

Actions), F32: function

parameter

SUP 1.1 and later

166 Lens User Button LEDs
1.9
0x00E0
array
read

only

The state of the lens

user button LEDs. Each

array element consists

of: String: button name,

U16: LED state (0/1)

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

167 Camera Temperature

State

1.9
0x00EF
U16
read

only

Camera temperature

state (see 8.14 -

Camera Temperature

States 0x00EF )

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

168 Auto WB Result
1.9
0x00E8
array
read

only

Latest result of Auto

White Balance function.

Array has 1 row with 4

values (U32 revision,

S32 flag, F32 CCT, F32

tint).

See 8.15 - Auto White

Balance (AutoWB)

0x00E8 

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

169 Power Voltage
1.9
0x00E7
array
read

only

List of battery, mains

voltages. Consists of:

F32: battery voltage,

F32: mains voltage,

F32: hotswap voltage

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

170 Power Capacity
1.9
0x00E9
array
read

only

List of battery, mains

capcities in percent.

Consists of: U32: battery

capacity, U32: mains

capacity, U32: hotswap

capacity

no
SUP 7.3 + ALEXA 35

SUP 1.1 and later

171 Monitor User Buttons
1.10
0x00E3
array
read

only

The Monitor user

buttons with their

currently assigned

actions. Each array

element consists of:

String: button name,

U32: user button action (

6.3.28 - List of Button

Actions), F32: function

parameter

no
SUP 7.3 + ALEXA 35

SUP 1.2 and later

172 Monitor User Button LEDs
1.10
0x00E4
array
read

only

The state of the Monitor

user button LEDs. Each

array element consists

of: String: button name,

U16: LED state (0/1)

no
SUP 7.3 + ALEXA 35

SUP 1.2 and later

173 Audio Recording Enabled
1.10
0x00EA
U8
Enable (1)/Disable (0)

Audio Recording and

query its state

no
SUP 7.3 + ALEXA 35

SUP 1.2 and later

174 Media Clip Count
1.10
0x