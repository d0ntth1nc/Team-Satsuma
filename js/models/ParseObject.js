/*
	Represents base parse.com object
	Application models should/may/must/need to/have to extend it
	
	This constructor accepts first parameter as object
	and sets the instance state to synchronized with the server.
	
	If the first parameter has different type
	it ignores the copy procedure and sets the
	instance state to new and not synchronized with the server.
	
	# See save and remove methods for more info about the instance sync state
	
	
	Prototype methods:
		* save() - Saves the current instance to the database. Returns promise.
		* remove() - Removes the current instance from the database. Returns promise.
		* toPointer() - Returns the current instance as Parse.com pointer type.
		
	Static methods:
		* loadAll( params ) - Makes get request to the server to get all objects of the current type.
			Accepts params as plain object which is converted to URI params and appended to the URL.
			Returns the request promise.
*/
"use strict";
define( [ "parseDotComHeader" ], function( parseHeader ) {
	
var URL = "https://api.parse.com/1/classes/";
	
function ParseObject( serverResponse ) {
	if ( typeof serverResponse !== "object" ) {
		this._existsOnServer = false;
		return this;
	}
	
	// The constructor is called when the server has returned raw response
	// So we parse the response and copy all properties to "this"
	var self = this;
	
	Object.keys( serverResponse ).forEach(function( key ) {
		if ( key === "createdAt" || key === "updatedAt" ) {
			self[ key ] =
				new Date( serverResponse[ key ] ).toLocaleString();
		} else {
			self[ key ] = serverResponse[ key ];
		}
	});
	
	this.updatedAt = this.updatedAt || this.createdAt;
	this._existsOnServer = true;
}

function notyError() {
	noty({
		text: "There was network related error! Try refreshing the page and/or check internet connection!",
		timeout: 1000
	});
}

function save() {
	this.beforeSave(); // Used to validate the data
	
	var url = URL + this.constructor.name,
		data = {},
		self = this,
		headers = Object.create( parseHeader ),
		User = require( "models/User" ),
		currentUser = User.getCurrent(),
		isNew = this._existsOnServer;
	
	// Very stupid... This shouldn`t be here, but i have no time to improve it, sorry :))
	if ( this.constructor.name !== "Answer" && currentUser == null ) { 
		throw Error( "Must be logged in first!" );
	}
	
	this.author = currentUser; // Make sure that we have the author
	
	if ( !this._existsOnServer ) {
		
		
		data.ACL = { "*": { "read": true } };
		
		if ( this.constructor.name !== "Answer" ) { // Again stupid...
			var userId = currentUser.objectId;
			data.ACL[ userId ] = { "read": true, "write": true };
		}
	}
	
	if ( this.constructor.name !== "Answer" ) { // Again stupid...
		headers[ "X-Parse-Session-Token" ] = currentUser.sessionToken;
	}
	
	Object.keys( this ).forEach(function( key ) {
		if ( self.hasOwnProperty( key ) &&
				key !== "_existsOnServer" &&
				key !== "objectId" &&
				key !== "updatedAt" &&
				key !== "createdAt" ) {
			
			// We would want to send parse objects as pointers
			if ( self[ key ] instanceof ParseObject ||
					self[ key ] instanceof User ) {
				data[ key ] = self[ key ].toPointer();
			} else {
				data[ key ] = self[ key ];
			}
		}
	});

	return $.ajax({
		method: isNew ? "PUT" : "POST",
		url: isNew ? url + "/" + this.objectId : url,
		data: JSON.stringify( data ),
		headers: headers,
		context: this
	})
	.done(function( response ) {
		this.constructor.call( this, response );
		
		var message = this.constructor.name;
		message += isNew ? " updated" : " saved";
		message += " successfuly";
		
		noty({
			text: message,
			timeout: 1000
		});
	})
	.fail( notyError );
}

function remove() {
	if ( !this._existsOnServer ) {
		throw Error( "This object doesn`t exist on the server" );
	}
	
	return $.ajax({
		method: "DELETE",
		url: URL + this.constructor.name + "/" + this.objectId,
		headers: parseHeader
	})
	.done(function() {
		noty({
			text: this.constructor.name + " removed sucecssfuly",
			timeout: 1000
		});
	})
	.fail( notyError );
}

function toPointer() {
	if ( !this._existsOnServer ) {
		throw Error( "This object does not exist in the database! Please save it first!" );
	}
	
	return {
		"__type": "Pointer",
		"className": this.constructor.name,
		"objectId": this.objectId
	};
}

ParseObject.prototype = {
	save: save,
	remove: remove,
	toPointer: toPointer,
	beforeSave: $.noop,
	constructor: ParseObject
}

ParseObject.loadAll = function( params ) {
	return $.ajax({
		method: "GET",
		url: URL + this.name,
		headers: parseHeader,
		data: params,
		context: this
	})
	.done(function( response ) {
		// This function may be inherited
		// We take "this" value to be sure that we point to the right constructor
		var TargetConstructor = this;
		
		response.results.forEach(function( rawData, index, arr ) {
			arr[ index ] = new TargetConstructor( rawData );
		});
	});
};

return ParseObject;
	
});