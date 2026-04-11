// Garmin GNX Select Preset PGN definition for canboatjs v3
//
// PGN 61184 — Select Preset (command 0x84)
//
// Field types use LOOKUP+MANUFACTURER_CODE (not MANUFACTURER) for toPgn encoding.

module.exports = {
  PGNs: [
    {
      PGN: 61184,
      Id: 'garminGnxKeypadSelectPreset',
      Description: 'Garmin GNX Keypad Select Preset',
      Type: 'Single',
      Complete: true,
      Length: 7,
      Fields: [
        {
          Order: 1,
          Id: 'manufacturerCode',
          Name: 'Manufacturer Code',
          BitLength: 11,
          BitOffset: 0,
          BitStart: 0,
          Match: 229,
          FieldType: 'LOOKUP',
          LookupEnumeration: 'MANUFACTURER_CODE',
          Signed: false
        },
        {
          Order: 2,
          Id: 'reserved',
          Name: 'Reserved',
          BitLength: 2,
          BitOffset: 11,
          BitStart: 3,
          FieldType: 'RESERVED'
        },
        {
          Order: 3,
          Id: 'industryCode',
          Name: 'Industry Code',
          BitLength: 3,
          BitOffset: 13,
          BitStart: 5,
          Match: 4,
          FieldType: 'LOOKUP',
          LookupEnumeration: 'INDUSTRY_CODE',
          Signed: false
        },
        {
          Order: 4,
          Id: 'command',
          Name: 'Command',
          BitLength: 8,
          BitOffset: 16,
          BitStart: 0,
          FieldType: 'NUMBER',
          Resolution: 1,
          Signed: false,
          Match: 0x84
        },
        {
          Order: 5,
          Id: 'productId',
          Name: 'Product ID',
          BitLength: 8,
          BitOffset: 24,
          BitStart: 0,
          FieldType: 'NUMBER',
          Resolution: 1,
          Signed: false
        },
        {
          Order: 6,
          Id: 'unknown1',
          Name: 'Unknown 1',
          BitLength: 8,
          BitOffset: 32,
          BitStart: 0,
          FieldType: 'NUMBER',
          Resolution: 1,
          Signed: false
        },
        {
          Order: 7,
          Id: 'unknown2',
          Name: 'Unknown 2',
          BitLength: 8,
          BitOffset: 40,
          BitStart: 0,
          FieldType: 'NUMBER',
          Resolution: 1,
          Signed: false
        },
        {
          Order: 8,
          Id: 'presetIndex',
          Name: 'Preset Index',
          BitLength: 8,
          BitOffset: 48,
          BitStart: 0,
          FieldType: 'NUMBER',
          Resolution: 1,
          Signed: false
        }
      ]
    }
  ]
}
