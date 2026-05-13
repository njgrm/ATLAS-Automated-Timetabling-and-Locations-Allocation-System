import fs from 'fs';

const prismaSchema = fs.readFileSync('D:/ATLAS/prisma/schema.prisma', 'utf-8');

function parsePrisma(schema) {
    const models = [];
    const enums = {};
    
    // Remove comments
    const noComments = schema.replace(/\/\/.*$/gm, '');
    
    // Parse enums
    const enumRegex = /enum\s+(\w+)\s+{([^}]+)}/g;
    let match;
    while ((match = enumRegex.exec(noComments)) !== null) {
        const enumName = match[1];
        const enumBody = match[2];
        const lines = enumBody.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('@@map'));
        enums[enumName] = lines;
    }
    
    const modelRegex = /model\s+(\w+)\s+{([^}]+)}/g;
    while ((match = modelRegex.exec(noComments)) !== null) {
        const modelName = match[1];
        const modelBody = match[2];
        
        let dbName = modelName;
        const mapRegex = /@@map\("([^"]+)"\)/;
        const mapMatch = mapRegex.exec(modelBody);
        if (mapMatch) {
            dbName = mapMatch[1];
        }

        const fields = [];
        const relationships = [];
        
        const lines = modelBody.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('@@')) continue;
            
            const parts = trimmed.split(/\s+/);
            const fieldName = parts[0];
            let fieldType = parts[1];
            
            if (!fieldType) continue;
            
            let dbFieldName = fieldName;
            const fieldMapRegex = /@map\("([^"]+)"\)/;
            const fieldMapMatch = fieldMapRegex.exec(trimmed);
            if (fieldMapMatch) {
                dbFieldName = fieldMapMatch[1];
            }
            
            const isPK = trimmed.includes('@id');
            const isRelation = trimmed.includes('@relation');
            const isArray = fieldType.includes('[]');
            const isOptional = fieldType.includes('?');
            
            const cleanType = fieldType.replace('[]', '').replace('?', '');
            
            if (isRelation) {
                const referencesRegex = /references:\s*\[([^\]]+)\]/;
                const fieldsRegex = /fields:\s*\[([^\]]+)\]/;
                const refMatch = referencesRegex.exec(trimmed);
                const fldMatch = fieldsRegex.exec(trimmed);
                
                if (refMatch && fldMatch) {
                    relationships.push({
                        fromField: dbFieldName,
                        localField: fldMatch[1],
                        targetModel: cleanType,
                        targetField: refMatch[1]
                    });
                }
            } else {
                let dbType = cleanType;
                if (enums[cleanType]) {
                    dbType = cleanType;
                } else if (cleanType === 'String') dbType = 'text';
                else if (cleanType === 'Int') dbType = 'integer';
                else if (cleanType === 'Float') dbType = 'float';
                else if (cleanType === 'Boolean') dbType = 'boolean';
                else if (cleanType === 'DateTime') dbType = 'timestamp';
                else if (cleanType === 'Json') dbType = 'jsonb';
                
                if (isArray && !enums[cleanType]) dbType += '[]';
                
                fields.push({
                    name: fieldName,
                    dbName: dbFieldName,
                    type: dbType,
                    isPK,
                    isFK: false
                });
            }
        }
        
        models.push({
            name: modelName,
            dbName,
            fields,
            relationships
        });
    }
    
    // Update FKs
    for (const model of models) {
        for (const rel of model.relationships) {
            const localField = model.fields.find(f => f.name === rel.localField);
            if (localField) {
                localField.isFK = true;
                rel.fromDbField = localField.dbName;
            } else {
                 rel.fromDbField = rel.localField; 
                 const f = model.fields.find(f => f.name === rel.localField || f.dbName === rel.localField);
                 if (f) f.isFK = true;
            }
            
            const targetModel = models.find(m => m.name === rel.targetModel);
            if (targetModel) {
                rel.targetDbName = targetModel.dbName;
                const targetField = targetModel.fields.find(f => f.name === rel.targetField);
                if (targetField) {
                    rel.targetDbField = targetField.dbName;
                } else {
                    rel.targetDbField = rel.targetField;
                }
            }
        }
    }
    
    return models;
}

function generateXML(models) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram id="ATLAS-ERD" name="ATLAS ERD">
    <mxGraphModel dx="2000" dy="2000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="8000" pageHeight="8000" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
`;

    // Hierarchical Placement (Sugiyama Approximation)
    const placementMap = {
        'departments': 0, 'grade_levels': 0, 'academic_years': 0, 'semesters': 0, 'admin_audits': 0, 'faculty_audits': 0, 'enrollpro_sync_logs': 0, 'api_keys': 0, 'password_resets': 0, 'user_sessions': 0,
        'schools': 1, 'users': 1, 'faculty': 1, 'rooms': 1, 'subjects': 1, 'class_templates': 1, 'generation_runs': 1,
        'faculty_mirrors': 2, 'subject_mirrors': 2, 'room_mirrors': 2, 'sections': 2, 'class_template_subjects': 2, 'run_logs': 2,
        'section_mirrors': 3, 'teaching_assignments': 3, 'timetables': 3, 'timetable_entries': 3
    };

    let colY = [100, 100, 100, 100];
    const COL_WIDTH = 600;
    const ROW_GAP = 200;
    
    let idCounter = 1000;
    function nextId() { return 'id-' + (idCounter++); }

    const modelIds = {};
    const fieldIds = {};

    for (const model of models) {
        const tableId = nextId();
        modelIds[model.dbName] = tableId;
        
        let col = placementMap[model.dbName];
        if (col === undefined) col = 3; // Default to rightmost if unknown
        
        let x = col * COL_WIDTH;
        let y = colY[col];
        
        const rowHeight = 30;
        const tableHeight = 30 + model.fields.length * rowHeight;
        
        xml += `        <mxCell id="${tableId}" parent="1" style="shape=table;startSize=30;container=1;collapsible=1;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;align=center;resizeLast=1;" value="${model.dbName}" vertex="1">
          <mxGeometry height="${tableHeight}" width="280" x="${x}" y="${y}" as="geometry" />
        </mxCell>\n`;
        
        let rowY = 30;
        for (const field of model.fields) {
            const rowId = nextId();
            const pkFkId = nextId();
            const valId = nextId();
            
            fieldIds[model.dbName + '.' + field.dbName] = rowId;
            
            xml += `        <mxCell id="${rowId}" parent="${tableId}" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;strokeColor=inherit;top=0;left=0;right=0;bottom=0;" value="" vertex="1">
          <mxGeometry height="${rowHeight}" width="280" y="${rowY}" as="geometry" />
        </mxCell>\n`;
            
            let pkFkLabel = '';
            if (field.isPK) pkFkLabel = 'PK';
            else if (field.isFK) pkFkLabel = 'FK';
            
            let pkFontStyle = field.isPK ? 'fontStyle=5;' : '';
            
            xml += `        <mxCell id="${pkFkId}" parent="${rowId}" style="shape=partialRectangle;overflow=hidden;connectable=0;fillColor=none;strokeColor=inherit;top=0;left=0;bottom=0;right=0;fontStyle=1;" value="${pkFkLabel}" vertex="1">
          <mxGeometry height="${rowHeight}" width="40" as="geometry">
            <mxRectangle height="${rowHeight}" width="40" as="alternateBounds" />
          </mxGeometry>
        </mxCell>\n`;
            
            xml += `        <mxCell id="${valId}" parent="${rowId}" style="shape=partialRectangle;overflow=hidden;connectable=0;fillColor=none;align=left;strokeColor=inherit;top=0;left=0;bottom=0;right=0;spacingLeft=6;${pkFontStyle}" value="${field.dbName} ${field.type}" vertex="1">
          <mxGeometry height="${rowHeight}" width="240" x="40" as="geometry">
            <mxRectangle height="${rowHeight}" width="240" as="alternateBounds" />
          </mxGeometry>
        </mxCell>\n`;
            
            rowY += rowHeight;
        }
        
        colY[col] += tableHeight + ROW_GAP;
    }
    
    // Edges
    for (const model of models) {
        for (const rel of model.relationships) {
            if (!rel.fromDbField || !rel.targetDbName) continue;
            const sourceId = fieldIds[model.dbName + '.' + rel.fromDbField];
            const targetId = fieldIds[rel.targetDbName + '.' + rel.targetDbField] || modelIds[rel.targetDbName];
            
            if (sourceId && targetId) {
                const edgeId = nextId();
                // Applied strict anchor points and backbone edge style
                xml += `        <mxCell id="${edgeId}" style="edgeStyle=entityRelationEdgeStyle;rounded=1;html=1;jumpStyle=arc;endArrow=ERzeroToMany;startArrow=ERmandOne;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" parent="1" source="${sourceId}" target="${targetId}">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>\n`;
            }
        }
    }

    xml += `      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
    
    return xml;
}

const models = parsePrisma(prismaSchema);
const xml = generateXML(models);
fs.writeFileSync('D:/ATLAS/ATLAS_ERD.xml', xml);
console.log('Successfully wrote ATLAS_ERD.xml with advanced layout.');
