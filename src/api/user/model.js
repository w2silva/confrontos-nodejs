import crypto from 'crypto'
import bcrypt from 'bcrypt'
import randtoken from 'rand-token'
import mongoose, { Schema } from 'mongoose'
import MongooseKeywords from 'mongoose-keywords'
import MongooseSequence from 'mongoose-sequence'
import { env } from '../../config'
import { sendMail } from './../../services/mailer'
import mailTemp from './../../assets/mail/welcome'

const roles = ['athleta', 'manager']

const UserSchema = new Schema({
  user_id: {
    type: Number,
    unique: true
  },
  sponsor_id: {
    type: Schema.ObjectId,
    required: false,
    ref: 'User'
  },
  email: {
    type: String,
    match: /^\S+@\S+\.\S+$/,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  display_name: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true
  },
  current_contract: {
    type: String,
    required: [true, 'Contract is required'],
    enum: ['basic', 'premium'],
    lowercase: true, 
    default: 'basic'
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: ['male', 'female', 'undefined'],
    lowercase: true, 
    default: 'undefined'
  },
  registration_ids: {
    type: [String],
    default: []
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: roles,
    default: 'athleta'
  },
  picture: {
    type: String,
    trim: true
  },
  providers: {
    facebook: String,
    google: String
  },
  activities: [{
    activity: {
      type: String
    },
    points: {
      type: Number
    },
  }],
  settings: [{
    setting: {
      type: String
    },
    value: {
      type: Schema.Types.Mixed
    },
  }],
  followers: [{
    type: Schema.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: Schema.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  toJSON: {
    virtuals: true,
    transform: (obj, ret) => { delete ret._id }
  }
})

UserSchema.path('email').set(function (email) {
  if (!this.picture || this.picture.indexOf('https://gravatar.com') === 0) {
    const hash = crypto.createHash('md5').update(email).digest('hex')
    this.picture = `https://gravatar.com/avatar/${hash}?d=identicon`
  }

  if (!this.display_name) {
    this.display_name = email.replace(/^(.+)@.+$/, '$1')
  }

  return email
})

UserSchema.pre('save', function (next) {
  if (this.isNew && env === 'production') {
    const { display_name, email, password } = this
    sendMail({
      name: display_name, 
      email: email, 
      subject: mailTemp['pt-br'].subject({
        user: { display_name, email, password }
      }),
      content: mailTemp['pt-br'].content({
        user: { display_name, email, password }
      })
    })
  }

  if (!this.isModified('password')) return next()

  /* istanbul ignore next */
  const rounds = env === 'test' ? 1 : 9

  bcrypt.hash(this.password, rounds).then((hash) => {
    this.password = hash
    next()
  }).catch(next)
})

UserSchema.methods = {
  view (full) {
    let view = {}
    let fields = ['user_id', 'display_name', 'picture', 'gender']

    if (full) {
      fields = [
        ...fields, 
        'id', 
        'email', 
        'role', 
        'registration_ids', 
        'current_contract', 
        'activities', 
        'settings', 
        'created_at'
      ]
    }

    fields.forEach((field) => { view[field] = this[field] })

    return view
  },

  authenticate (password) {
    return bcrypt.compare(password, this.password).then((valid) => valid ? this : false)
  }
}

UserSchema.statics = {
  roles,

  findOrCreateFromProvider ({ provider, id, email, name, picture }) {
    const User = this

    return this.findOne({ $or: [{ [`providers.${provider}`]: id }, { email }] }).then((user) => {
      if (user) {
        user.providers[provider] = id
        user.display_name = name
        user.picture = picture
        return user.save()
      } else {
        const password = randtoken.generate(16)

        return User.create({ 
          providers: { [provider]: id }, 
          email, 
          password, 
          display_name: name, 
          picture
        })
      }
    })
  }
}

UserSchema.plugin(MongooseKeywords, { paths: ['email', 'display_name'] })

const AutoIncrement = MongooseSequence(mongoose)
UserSchema.plugin(AutoIncrement, { inc_field: 'user_id' })

const model = mongoose.model('User', UserSchema)

export const schema = model.schema
export default model
