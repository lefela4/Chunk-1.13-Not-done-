const butils = require('butils');

class BlockState {
	
	static TotalNumberOfStates(){
		
		return 14; /** Currently 14 */
		
	};
	
};

class Palette {
	
	constructor(){
		
		this.idToState = new Map();
		this.stateToId = new Map();
		this.bitsPerBlock = 0;
		
	};
	
	GetStateFromGlobalPaletteID(BlockState){ //Should return the block id
		
		/** TODO */
		
	};
	
	GetGlobalPaletteIDFromState(id){ //Should return the blockstate
		
		/** TODO */
		
	};
	
	Read(){};
	
	Write(){};
	
};


class IndirectPalette extends Palette {
	
	IndirectPalette(palBitsPerBlock){
		
		this.bitsPerBlock = palBitsPerBlock;
		
	};
	
	IdForState(state){
		
		return this.idToState.get(state);
		
	};
	
	GetBitsPerBlock(){
		
		return this.bitsPerBlock;
		
	};
	
	Read(data, offset){
		
		offset = offset || 0;
		
		this.idToState = new Map();
		this.stateToId = new Map();
		
		let length = butils.readVarint(data, offset);
		offset += 2;
		
		for(let id = 0; id < length; id++){
			
			let stateId = butils.readVarint(data, offset);
			offset += 2;
			
			let state = this.GetStateFromGlobalPaletteID(stateId);
			
			this.idToState.set(id, state);
			this.stateToId.set(state, id);
			
		};
		
	};
	
	Write(data, offset){
		
		offset = offset || 0;
		assert(this.idToState.size() == this.stateToId.size());
		butils.writeVarint(data, this.idToState.size(), offset);
		offset += 2;
		
		for(let id = 0; id < this.idToState.size(); id++){
			
			let state = this.idToState.get(id);
			let stateId = this.GetGlobalPaletteIDFromState(state);
			butils.writeVarint(data, stateId, offset);
			offset += 2;
			
		};
		
	};
	
};


class DirectPalette extends Palette {
	
	IdForState(BlockState){
		return this.GetGlobalPaletteIDFromState(BlockState);
	};
	
	StateForId(id){
		return this.GetStateFromGlobalPaletteID(id);
	};
	
	GetBitsPerBlock(){
		return Math.ceil(Math.log2(BlockState.TotalNumberOfStates()));
	};
	
	Read(data){ /** No Data */ };
	
	Write(data){ /** No Data */ };
	
};

function ChoosePalette(bitsPerBlock){
	
	if(bitsPerBlock <= 4){
		
		return new IndirectPalette(4);
		
	}else if(bitsPerBlock <= 8){
		
		return new IndirectPalette(bitsPerBlock);
		
	}else{
		
		return new DirectPalette();
		
	};
	
};

module.exports = ChoosePalette;
