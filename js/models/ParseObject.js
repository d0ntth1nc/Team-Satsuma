/*
	Represents base parse.com object
	Application models should/may/must/need to/have to extend it
	
	This constructor accepts first parameter as object
	and sets the instance state to synchronized with the server.
	
	If the first parameter has different type
	it ignores the copy procedure and sets the
	instance state to new and not synchronized with the server.
	
	# See line 65 and 66 for more info about the instance sync state
*/
"use strict";
define( [
	"parseDotComHeader",
	"models/User"
], function( parseHeader, User ) {

var URL = "https://api.parse.com/1/classes/";
	
function ParseObject( serverResponse ) {
	if ( typeof serverResponse == "object" ) {
		// The constructor is called when the server has returned raw response
		// So we parse the response and copy all properties to "this"
		
		var keys = Object.keys( serverResponse ),
			self = this;
			
		keys.forEach(function( key ) {
			if ( key === "createdAt" || key === "updatedAt" ) {
				self[ key ] =
					new Date( serverResponse[ key ] ).toLocaleString();
			} else {
				self[ key ] = serverResponse[ key ];
			}
		});
		
		if ( !this.updatedAt ) {
			this.updatedAt = this.createdAt;
		}
		
		this._existsOnServer = true;
	} else {
		this._existsOnServer = false;
	}
}

function save() {
	var url = URL + this.constructor.name,
		deferred = $.Deferred(),
		data = {},
		self = this,
		headers = Object.create( parseHeader ),
		currentUser = User.getCurrent();
		
		
	/* Skip ACL stuff for now
		
	if ( currentUser == null ) {
		deferred.rejectWith( this, "Cannot save object as anonymous user!" );
		return deferred.promise();
	}
	
	if ( !this._existsOnServer ) {
		data.ACL = {
			currentUser.objectId: { "read": true, "write": true },
			"*": { "read": true }
		};
	}
	
	headers[ "X-Parse-Session-Token" ] = currentUser.sessionToken;
	
	*/
	
	Object
		.keys( this )
		.forEach(function( key ) {
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

	$.ajax({
		method: this._existsOnServer ? "PUT" : "POST",
		url: this._existsOnServer ? url + "/" + this.objectId : url,
		data: JSON.stringify( data ),
		headers: headers,
		context: this
	})
	.done(function( response ) {
		this.constructor.call( this, response );
		deferred.resolveWith( this );
	})
	.fail( $.proxy( deferred.reject, this ) );
	
	return deferred.promise();
}

function remove() {
	var deferred = $.Deferred();
	
	if ( this._existsOnServer ) {
		$.ajax({
			method: "DELETE",
			url: URL + this.constructor.name + "/" + this.objectId,
			headers: parseHeader
		})
		.done( $.proxy( deferred.resolve, this ) )
		.fail( $.proxy( deferred.reject, this ) );
	} else {
		deferred.resolveWith( this );
	}
	
	return deferred.promise();
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
	constructor: ParseObject
}

ParseObject.loadAll = function( params ) {
	var deferred = $.Deferred();
	
	$.ajax({
		method: "GET",
		url: URL + this.name,
		headers: parseHeader,
		data: params,
		context: this
	})
	.done(function( response ) {
		// This function may be inherited
		// We take "this" value to be sure that we point to the right constructor
		var Constructor = this,
			results = response.results.map(function( rawData ) {
				return new Constructor( rawData );
			});
		
		deferred.resolve( results );
	})
	.fail( $.proxy( deferred.reject, this ) );
	
	return deferred.promise();
};

return ParseObject;
	
});