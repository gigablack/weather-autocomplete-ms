import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'cities',
  versionKey: false,
})
export class City extends Document {
  @Prop({
    type: String,
    required: true,
    index: true,
    trim: true,
  })
  name: string;

  @Prop({
    type: String,
    required: true,
    index: true,
    trim: true,
  })
  country: string;

  @Prop({ type: Number })
  latitude?: number;

  @Prop({ type: Number })
  longitude?: number;
}

export const CitySchema = SchemaFactory.createForClass(City);

CitySchema.index({ name: 1, country: 1 }, { unique: true });
CitySchema.index({ name: 'text', country: 'text' });
