const butils = require('butils');
const BitBuffer = require('bit-buffer');
const ChoosePalette = require('./Palette');

const SECTION_WIDTH = 16;
const SECTION_HEIGHT = 16;

const currentDimension = {
	
	HasSkylight(){ 
		
		/** TODO */
		
		return true;
		
	}
	
};

class ChunkManager {
	
	constructor(){
		
		this.chunks = new Map();
		
	};
	
	static GetExistingChunk(x, z){
	
		return this.chunks.get('chunk_' + x + '_' + z);
	
	};
	
	static SetChunk(x, z, chunk){
		this.chunks.set('chunk_' + x + '_' + z, chunk);
	};
	
};

class Tag {
	
	constructor(buf, offset){
		
		this.buf = buf;
		this.offset = offset;
		
		this.x = this.buf.readInt16LE(this.offset);
		this.y = this.buf.readInt16LE(this.offset);
		this.z = this.buf.readInt16LE(this.offset);
		
	};
	
	SetOffset(offset){
		
		this.offset = offset;
		
	};
	
	GetInt(name){
		
		switch(name){
			
			case 'x':
				
				//Uint16?
				return this.x;
				
				break;
				
			case 'y':
				
				return this.y;
				
				break;
				
			case 'z':
				
				return this.z;
				
				break;
			
			default:
				
				throw('Tag doesnt exist.');
				
				break;
			
		};
		
	};
	
};

class Chunk {
	
	constructor(x, z){
		
		this.x = x;
		this.z = z;
		this.blocks = new Map();
		this.biome = new Map();
		this.Sections = {};
		
	};
	
	ReadCompoundTag(buf){
		
		return new Tag(buf);
	
	};
	
	AddBlockEntity(x, y, z, tag){
		
		this.blocks.set('block_' + x + '_' + y + '_' + z, tag);
		
	};
	
	SetBiome(x, z, value){
		
		this.biome.set('Biome_' + x + '_' + z, value);
		
	};
	
};

class ChunkSection {
	
	constructor(){
		
		this.blocks = new Map();
		this.blockStats = new Map();
		this.blockLight = new Map();
		this.skyLight = new Map();
		
	};
	
	SetSkyLight(x, y, z, value){
		
		this.blockLight.set('light_' + x + '_' + y + '_' + z, value);
		
	};
	
	SetState(blockX, blockY, blockZ, blockId, state){
		
		this.blockStats.set('block_' + blockX + '_' + blockY + '_' + blockZ, state);
		this.blocks.set('block_' + blockX + '_' + blockY + '_' + blockZ, {x: blockX, y: blockY, z: blockZ, id: blockId, state: state});
		
	};
	
	SetBlockLight(){
		
		this.skyLight.set('block_' + x + '_' + y + '_' + z, value);
		
	};
	
};

function ReadChunkDataPacket(buf, offset){
	
	offset = offset || 0;
	
	let bb = new BitBuffer.BitSteam(buf);
	bb.index = offset;
	bb.bigEndian = false;
	
	let x = butils.readInt(buf, bb.index);
	bb.index++;
	
	let x = butils.readInt(buf, bb.index);
	bb.index++;
	
	let full = bb.readBoolean();
	let chunk = null;
	
	if(full){
		
		chunk = new Chunk(x, z);
		
	}else{
		
		chunk = GetExistingChunk(x, z);
		
	};
	
	let mask = butils.readVarint(buf, bb.index);
	bb.index += 2;
	
	let size = butils.readVarint(buf, bb.index);
	bb.index += 2;
	
	readChunkColumn(chunk, full, mask, bb.readArrayBuffer(size));
	
	let blockEntityCount = butils.readVarint(buf, bb.index);
	bb.index += 2;
	
	for(let i = 0; i < blockEntityCount; i++){
		
		let tag = chunk.ReadCompoundTag(buf);
		chunk.AddBlockEntity(tag.GetInt('x'), tag.GetInt('y'), tag.GetInt('z'), tag);
		
	};
	
	return chunk;
	
};

function readChunkColumn(chunk, full, mask, data){
	
	for(let sectionY = 0; sectionY < (CHUNK_HEIGHT / SECTION_HEIGHT); sectionY ++){
		
		if((mask & (1 << sectionY )) != 0){ //Is the given bit set in the mask?
			
			let buf = new BitBuffer.BitSteam(data);
			let bitsPerBlock = buf.readBits(1);
			console.log('There is ' + bitsPerBlock + ' Bits Per Block.');
			let palette = ChoosePalette(bitsPerBlock);
			palette.Read(data, 1);
			
			// A bitmask that contains bitsPerBlock set bits
            let individualValueMask = ((1 << bitsPerBlock) - 1);
			
			let dataArrayLength = butils.readVarint(data, bb.index);
			bb.index += 2;
			
			let dataArray = new Uint32Array((bb.readArrayBuffer(dataArrayLength)).buffer);
			
			let section = new ChunkSection();
			
			for(let blockY = 0; blockY < SECTION_HEIGHT; blockY++){
				
				for(let blockZ = 0; blockZ < SECTION_WIDTH; blockZ++) {
					
					for(let blockX = 0; blockX < SECTION_WIDTH; blockX++) {
						
						let blockNumber = (((blockY * SECTION_HEIGHT) + blockZ) * SECTION_WIDTH) + blockX;
						let startLong = (blockNumber * bitsPerBlock) / 64;
						let startOffset = (blockNumber * bitsPerBlock) % 64;
						let endLong = ((blockNumber + 1) * bitsPerBlock - 1) / 64;
						
						let blockId;
						
						if(startLong == endLong){
							
							blockId = (dataArray[startLong] >> startOffset);
							
						}else{
							
							let endOffset = 64 - startOffset;
							blockId = (dataArray[startLong] >> startOffset | dataArray[endLong] << endOffset);
							
						};
						
						blockId &= individualValueMask;
						
						/** Data are always valid for palette, if it a power of 2 - 1 it a light data */
						let state = palette.StateForId(blockId);
						section.SetState(blockX, blockY, blockZ, blockId, state);
						
					};
					
				};
				
			};
			
			for(let blockY = 0; blockY < SECTION_HEIGHT; blockY++){

				for(let blockZ = 0; blockZ < SECTION_WIDTH; blockZ++) {
					
					for(let blockX = 0; blockX < SECTION_WIDTH; blockX++) {
						
						let value = buf.readBits(1);
						
						section.SetBlockLight(blockX, blockY, blockZ, value & 0xF);
						section.SetBlockLight(blockX + 1, blockY, blockZ, (value >> 4) & 0x0F);
						
					};
					
				};
				
			};
			
			if(currentDimension.HasSkylight()){ // IE, current dimension is overworld / 0
				
				for(let blockY = 0; blockY < SECTION_HEIGHT; blockY++){

					for(let blockZ = 0; blockZ < SECTION_WIDTH; blockZ++) {
						
						for(let blockX = 0; blockX < SECTION_WIDTH; blockX += 2) {
							
							let value = buf.readBits(1);
							
							section.SetSkyLight(blockX, blockY, blockZ, value & 0xF);
							section.SetSkyLight(blockX + 1, blockY, blockZ, (value >> 4) & 0x0F);
							
						};
						
					};
					
				};
				
			};
			
			chunk.Sections[sectionY] = section;
			
		};
		
	};
	
	for(let z = 0; z < SECTION_WIDTH; z++){
		
		for(let x = 0; x < SECTION_WIDTH; x++){
			
			chunk.SetBiome(x, z, buf.readBits(1));
			
		};
		
	};
	
};
