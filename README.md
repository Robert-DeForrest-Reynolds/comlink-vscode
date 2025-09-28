# comlink README
What is the point?

Because documentation, and commenting is important. The thing is, it's incredibly subjective. All comments being there benefits everyone, but everyone personally only needs few comments here and there on things they specifically don't understand.
As well, for incredibly large, and convoluted projects, it could prove very fruitful to have a heavily-detailed documentation embedded within the source files, but bloating the files themselves has always been a problem.

I made comlink to try to solve that problem, and well, just because I wanted to. I find this tool very useful myself, and that's enough to make it.



## comlink <-> editor communication
If you want to create an extension for comlink, or even implement into your text editor, I'll explain how here:<br>
Comlink when running is constantly waiting for input. You tell it what to do by prefixing the data you send it, and it will reply with data with the same prefix.<br>
To send a comment to create, you send `~some comment` to comlink, and the next reply from comlink will be an id for that comment for you to replace the comment text in the editor with. <br>
Deleting, and editing a comment is best done through commands if your text editor supports them. The command should


**the editor is responsible for telling comlink:**
 - handling the activation, and parsing requirements
   - `<comment-symbol>~* comment contents ~` turns into `<comment-symbol>id:<id>`
 - when a comment has been created, edited, or deleted
 - what the source file of the comment is
 - what line the comment is on
 - what the comment is

**comlink is responsible for:**
 - tracking id's, and telling the editor what the id of the comment is
 - creating, editing, and removing comments within the database
 - pruning the database
 - managing empty indexes and lost references



### TO DO
 - prune database upon deactivating editor
 we can save 'line references' to the database as well, which will essentially be the comments line with id on it, so when pruning, we can find it
 - "lost references", upon activating, comlink should verify all comments, and warn about lost references, which are comments that exist in the database, but have no id in the source files. since line references hold the file name, the line number, the content, and the id, it should be relatively easy to find the location of lost reference.
    - maybe a repair mechanism where the user can decide to repair the line with y/n input
 - ability to edit a comment through the editor. there should be two ways to edit a comment: editing the existing text, and replacing the existing text
 - deletion of a comment through the editor
    - when a user deletes a comment, that comment index is put into a list of empty indexes, which will be filled in priority
    - when empty indexes over 20, a warning is presented that you should probably prune the database
    - empty indexes are kept in memory, and on startup are determined when finding lost references in code
 - find a way to "package" comlink comments so that they can be removed during building for production, and or put back
 - "reordering" feature, where comlink goes through your project files alphabetically, and reorders all comment id's. optionally can provide a specified order of parsing
 - optional ai generation comlink comments of lines that have no comment ids
